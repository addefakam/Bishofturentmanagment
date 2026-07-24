import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);

    const [frequentStays, auditLogs] = await Promise.all([
      db.frequentStayAlert.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);

    // Hotspot: group suspect matches by provider
    const matches = await db.suspectMatch.findMany({
      select: { providerName: true, providerId: true, createdAt: true, id: true, details: true, suspectedPerson: { select: { severity: true } } },
    });
    const hotspotMap = new Map<string, { providerName: string; providerId: string; matchCount: number; criticalCount: number; highCount: number }>();
    for (const m of matches) {
      const key = m.providerId || m.providerName;
      if (!hotspotMap.has(key)) {
        hotspotMap.set(key, { providerName: m.providerName, providerId: m.providerId, matchCount: 0, criticalCount: 0, highCount: 0 });
      }
      const entry = hotspotMap.get(key)!;
      entry.matchCount++;
      const sev = m.suspectedPerson?.severity || "";
      if (sev === "CRITICAL") entry.criticalCount++;
      if (sev === "HIGH") entry.highCount++;
    }

    // Occupancy vs Crime correlation (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const reservations = await db.reservation.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, status: true, providerId: true },
    });
    const suspectMatches = await db.suspectMatch.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, providerName: true },
    });

    const monthlyData: { month: string; reservations: number; suspectMatches: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const resCount = reservations.filter((r) => r.createdAt >= monthStart && r.createdAt < monthEnd).length;
      const matchCount = suspectMatches.filter((m) => m.createdAt >= monthStart && m.createdAt < monthEnd).length;
      monthlyData.push({ month: monthStr, reservations: resCount, suspectMatches: matchCount });
    }

    return NextResponse.json({
      frequentStays,
      hotspotData: Array.from(hotspotMap.values()).sort((a, b) => b.matchCount - a.matchCount),
      occupancyCrimeCorrelation: monthlyData,
      recentActivity: auditLogs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch intelligence";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
