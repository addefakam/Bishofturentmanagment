import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    const { searchParams } = new URL(req.url);
    const reviewed = searchParams.get("reviewed");
    const alerts = await db.frequentStayAlert.findMany({
      where: reviewed !== null ? { isReviewed: reviewed === "true" } : {},
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(alerts);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch frequent stays";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    // Analyze guests across all providers for frequent stay patterns
    const guests = await db.guest.findMany({
      include: { provider: { select: { name: true } }, reservations: { select: { checkIn: true, checkOut: true, status: true } } },
    });

    // Group guests by phone or ID number across providers
    const phoneMap = new Map<string, typeof guests>();
    const idMap = new Map<string, typeof guests>();

    for (const g of guests) {
      if (g.phone) {
        const key = g.phone.toLowerCase();
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key)!.push(g);
      }
      if (g.idNumber) {
        const key = g.idNumber.toLowerCase();
        if (!idMap.has(key)) idMap.set(key, []);
        idMap.get(key)!.push(g);
      }
    }

    let created = 0;
    const process = (group: typeof guests) => {
      if (group.length < 2) return;
      const uniqueProviders = [...new Set(group.map((g) => g.provider?.name || "Unknown"))];
      if (uniqueProviders.length < 2) return;

      const allReservations = group.flatMap((g) => g.reservations).sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
      if (allReservations.length < 2) return;

      // Calculate average days between stays
      const stays = allReservations.filter((r) => r.status !== "CANCELLED");
      if (stays.length < 2) return;
      let totalDays = 0;
      for (let i = 1; i < stays.length; i++) {
        totalDays += Math.abs(new Date(stays[i].checkIn).getTime() - new Date(stays[i - 1].checkIn).getTime()) / (1000 * 60 * 60 * 24);
      }
      const avgDays = totalDays / (stays.length - 1);

      // Only create alert if pattern is suspicious
      if (uniqueProviders.length >= 2 && avgDays < 30) {
        const riskLevel = avgDays < 7 ? "HIGH" : avgDays < 14 ? "MEDIUM" : "LOW";
        db.frequentStayAlert.create({
          data: {
            guestName: group[0].name,
            guestPhone: group[0].phone,
            guestIdNumber: group[0].idNumber,
            providerNames: JSON.stringify(uniqueProviders),
            stayCount: stays.length,
            avgDaysBetween: Math.round(avgDays * 10) / 10,
            riskLevel,
          },
        }).catch(() => {});
        created++;
      }
    };

    phoneMap.forEach(process);
    idMap.forEach(process);

    return NextResponse.json({ message: `Analysis complete. ${created} new alerts created.`, created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to analyze frequent stays";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
