import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice, AuthError } from "@/lib/tenant";
import { requirePoliceMinRank } from "@/lib/police-permissions";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    const { searchParams } = new URL(req.url);
    const reviewed = searchParams.get("reviewed");
    const alerts = await db.frequentStayAlert.findMany({
      where: reviewed !== null ? { isReviewed: reviewed === "true" } : {},
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json(alerts);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    requirePoliceMinRank(auth, "DETECTIVE");

    // Step 1: Find guests who share a phone OR idNumber across multiple providers
    // Using pure Prisma queries instead of raw SQL for reliability.
    const allGuests = await db.guest.findMany({
      where: {
        OR: [
          { phone: { not: null, not: "" } },
          { idNumber: { not: null, not: "" } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        idNumber: true,
        providerId: true,
        provider: { select: { name: true } },
        reservations: {
          where: { status: { not: "CANCELLED" } },
          select: { checkIn: true, status: true },
          orderBy: { checkIn: "asc" },
        },
      },
    });

    // Step 2: Group guests by lowercased phone and idNumber
    const phoneGroups = new Map<string, typeof allGuests>();
    const idGroups = new Map<string, typeof allGuests>();

    for (const guest of allGuests) {
      if (guest.phone && guest.phone.trim()) {
        const key = guest.phone.trim().toLowerCase();
        if (!phoneGroups.has(key)) phoneGroups.set(key, []);
        phoneGroups.get(key)!.push(guest);
      }
      if (guest.idNumber && guest.idNumber.trim()) {
        const key = guest.idNumber.trim().toLowerCase();
        if (!idGroups.has(key)) idGroups.set(key, []);
        idGroups.get(key)!.push(guest);
      }
    }

    // Step 3: Keep only groups with 2+ distinct providers
    const duplicateGroups: { linkType: string; linkKey: string; guests: typeof allGuests }[] = [];
    const seen = new Set<string>(); // deduplicate guests that appear in both phone and id groups

    for (const [linkKey, guests] of phoneGroups) {
      const uniqueProviders = new Set(guests.map(g => g.providerId));
      if (uniqueProviders.size >= 2) {
        const deduped = guests.filter(g => {
          const k = g.id;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (deduped.length >= 2) {
          duplicateGroups.push({ linkType: "phone", linkKey, guests: deduped });
        }
      }
    }
    for (const [linkKey, guests] of idGroups) {
      const uniqueProviders = new Set(guests.map(g => g.providerId));
      if (uniqueProviders.size >= 2) {
        const deduped = guests.filter(g => {
          const k = g.id;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (deduped.length >= 2) {
          duplicateGroups.push({ linkType: "idNumber", linkKey, guests: deduped });
        }
      }
    }

    if (duplicateGroups.length === 0) {
      logAudit(req, { action: "FREQUENT_STAYS_ANALYSIS", details: "No duplicates found" });
      return NextResponse.json({ message: "Analysis complete. 0 new alerts created.", created: 0 });
    }

    // Step 4: Compute risk metrics and create alerts
    await db.frequentStayAlert.deleteMany({});

    const alertsToCreate: Array<{
      guestName: string;
      guestPhone: string;
      guestIdNumber: string;
      providerNames: string;
      stayCount: number;
      avgDaysBetween: number;
      riskLevel: string;
    }> = [];

    for (const group of duplicateGroups) {
      const uniqueProviders = Array.from(new Set(group.guests.map(g => g.provider.name)));
      if (uniqueProviders.length < 2) continue;

      // Combine all reservations across guests in the group, sorted by check-in
      const allReservations = group.guests
        .flatMap(g => g.reservations.map(r => ({ checkIn: r.checkIn, status: r.status })))
        .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

      if (allReservations.length < 2) continue;

      // Average days between consecutive check-ins
      let totalDays = 0;
      for (let i = 1; i < allReservations.length; i++) {
        totalDays += Math.abs(
          new Date(allReservations[i].checkIn).getTime() -
          new Date(allReservations[i - 1].checkIn).getTime()
        ) / (1000 * 60 * 60 * 24);
      }
      const avgDays = totalDays / (allReservations.length - 1);

      // Only flag if avg gap < 30 days
      if (avgDays >= 30) continue;

      const riskLevel = avgDays < 7 ? "HIGH" : avgDays < 14 ? "MEDIUM" : "LOW";
      const firstGuest = group.guests[0];
      alertsToCreate.push({
        guestName: firstGuest.name,
        guestPhone: firstGuest.phone || "",
        guestIdNumber: firstGuest.idNumber || "",
        providerNames: JSON.stringify(uniqueProviders),
        stayCount: allReservations.length,
        avgDaysBetween: Math.round(avgDays * 10) / 10,
        riskLevel,
      });
    }

    // Step 5: Batch-create alerts
    if (alertsToCreate.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < alertsToCreate.length; i += BATCH_SIZE) {
        const batch = alertsToCreate.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(alert =>
            db.frequentStayAlert.create({ data: alert }).catch(err => {
              console.error("[frequent-stays] Failed to create alert:", err);
            })
          )
        );
      }
    }

    logAudit(req, {
      action: "FREQUENT_STAYS_ANALYSIS",
      details: `Created ${alertsToCreate.length} alerts from ${duplicateGroups.length} duplicate groups`,
    });

    return NextResponse.json({
      message: `Analysis complete. ${alertsToCreate.length} new alerts created.`,
      created: alertsToCreate.length,
      duplicateGroups: duplicateGroups.length,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
