import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice, AuthError } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

/**
 * GET /api/police-reports?type=...&dateFrom=...&dateTo=...&providerId=...
 *
 * Police Admin reports endpoint. Generates statistics across the system.
 *
 * Report types:
 *  - guest-registration: Guest registration trends by provider, nationality, gender
 *  - occupancy: Room occupancy rates, check-in/out trends
 *  - revenue: Payment analysis by method, cash anomalies
 *  - provider-compliance: Provider status, license compliance
 *  - suspicious-activity: Anomaly records, suspect matches, severity breakdown
 *  - guest-movement: Cross-provider guests, frequent stayers, short-stay patterns
 */

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") || "guest-registration";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const providerId = searchParams.get("providerId") || "";

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const providerFilter = providerId
      ? Prisma.sql`AND p."id" = ${providerId}`
      : Prisma.sql``;
    const providerFilterDirect = providerId
      ? Prisma.sql`AND "providerId" = ${providerId}`
      : Prisma.sql``;

    let data: Record<string, unknown>;

    switch (type) {
      case "guest-registration":
        data = await guestRegistrationReport(dateFilter, providerFilter);
        break;
      case "occupancy":
        data = await occupancyReport(dateFilter, providerFilter);
        break;
      case "revenue":
        data = await revenueReport(dateFilter, providerFilter);
        break;
      case "provider-compliance":
        data = await providerComplianceReport();
        break;
      case "suspicious-activity":
        data = await suspiciousActivityReport(dateFilter, providerFilterDirect);
        break;
      case "guest-movement":
        data = await guestMovementReport(dateFilter, providerFilter);
        break;
      default:
        return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }

    logAudit(req, { action: "POLICE_REPORT", details: `Generated ${type} report` });
    return NextResponse.json({ type, ...data, generatedAt: new Date().toISOString() });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[police-reports] Error:", error);
    const message = error instanceof Error ? error.message : "Report generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Date filter helper ──
function buildDateFilter(dateFrom: string, dateTo: string): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (dateFrom) parts.push(Prisma.sql`g."createdAt" >= ${dateFrom}::date`);
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setDate(toDate.getDate() + 1);
    parts.push(Prisma.sql`g."createdAt" < ${toDate.toISOString().split("T")[0]}::date`);
  }
  return parts.length > 0
    ? Prisma.sql`AND ${Prisma.join(parts, Prisma.sql` AND `)}`
    : Prisma.sql``;
}

// ── 1. Guest Registration Report ──
async function guestRegistrationReport(
  dateFilter: Prisma.Sql,
  providerFilter: Prisma.Sql
): Promise<Record<string, unknown>> {
  const [byProvider, byNationality, byGender, dailyTrend, total, todayNew] =
    await Promise.all([
      db.$queryRaw<{ providerName: string; count: bigint }[]>(
        Prisma.sql`SELECT p."name" as "providerName", COUNT(*)::bigint as count
          FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE 1=1 ${dateFilter} ${providerFilter}
          GROUP BY p."name" ORDER BY count DESC LIMIT 30`
      ),
      db.$queryRaw<{ nationality: string; count: bigint }[]>(
        Prisma.sql`SELECT COALESCE(NULLIF(g."nationality", ''), 'Unknown') as "nationality", COUNT(*)::bigint as count
          FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE 1=1 ${dateFilter} ${providerFilter}
          GROUP BY g."nationality" ORDER BY count DESC LIMIT 20`
      ),
      db.$queryRaw<{ gender: string; count: bigint }[]>(
        Prisma.sql`SELECT COALESCE(NULLIF(g."gender", ''), 'Unknown') as "gender", COUNT(*)::bigint as count
          FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE 1=1 ${dateFilter} ${providerFilter}
          GROUP BY g."gender" ORDER BY count DESC`
      ),
      db.$queryRaw<{ date: string; count: bigint }[]>(
        Prisma.sql`SELECT DATE(g."createdAt") as "date", COUNT(*)::bigint as count
          FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE g."createdAt" >= NOW() - INTERVAL '30 days' ${providerFilter}
          GROUP BY DATE(g."createdAt") ORDER BY "date" ASC`
      ),
      db.$queryRaw<{ c: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint as c FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE 1=1 ${dateFilter} ${providerFilter}`
      ),
      db.$queryRaw<{ c: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint as c FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE g."createdAt" >= CURRENT_DATE ${providerFilter}`
      ),
    ]);

  return {
    summary: {
      total: Number(total[0]?.c || 0),
      todayNew: Number(todayNew[0]?.c || 0),
    },
    byProvider: byProvider.map((r) => ({
      name: r.providerName,
      value: Number(r.count),
    })),
    byNationality: byNationality.map((r) => ({
      name: r.nationality,
      value: Number(r.count),
    })),
    byGender: byGender.map((r) => ({
      name: r.gender,
      value: Number(r.count),
    })),
    dailyTrend: dailyTrend.map((r) => ({
      date: String(r.date),
      count: Number(r.count),
    })),
  };
}

// ── 2. Occupancy Report ──
async function occupancyReport(
  dateFilter: Prisma.Sql,
  providerFilter: Prisma.Sql
): Promise<Record<string, unknown>> {
  const [statusBreakdown, checkinTrend, checkoutTrend, roomStatusByProvider, avgNights, avgOccupancy] =
    await Promise.all([
      db.$queryRaw<{ status: string; count: bigint }[]>(
        Prisma.sql`SELECT r."status", COUNT(*)::bigint as count
          FROM "Reservation" r JOIN "Provider" p ON p."id" = r."providerId"
          WHERE 1=1 ${dateFilter} ${providerFilter}
          GROUP BY r."status" ORDER BY count DESC`
      ),
      db.$queryRaw<{ date: string; count: bigint }[]>(
        Prisma.sql`SELECT DATE(r."checkIn") as "date", COUNT(*)::bigint as count
          FROM "Reservation" r JOIN "Provider" p ON p."id" = r."providerId"
          WHERE r."checkIn" >= CURRENT_DATE - INTERVAL '30 days' AND r."status" != 'CANCELLED' ${providerFilter}
          GROUP BY DATE(r."checkIn") ORDER BY "date" ASC`
      ),
      db.$queryRaw<{ date: string; count: bigint }[]>(
        Prisma.sql`SELECT DATE(r."checkOut") as "date", COUNT(*)::bigint as count
          FROM "Reservation" r JOIN "Provider" p ON p."id" = r."providerId"
          WHERE r."checkOut" >= CURRENT_DATE - INTERVAL '30 days' AND r."status" != 'CANCELLED' ${providerFilter}
          GROUP BY DATE(r."checkOut") ORDER BY "date" ASC`
      ),
      db.$queryRaw<{
        providerName: string; total: bigint; available: bigint; occupied: bigint; maintenance: bigint; reserved: bigint;
      }[]>(
        Prisma.sql`SELECT p."name" as "providerName",
          COUNT(*)::bigint as total,
          SUM(CASE WHEN rm."status" = 'AVAILABLE' THEN 1 ELSE 0 END)::bigint as available,
          SUM(CASE WHEN rm."status" = 'OCCUPIED' THEN 1 ELSE 0 END)::bigint as occupied,
          SUM(CASE WHEN rm."status" = 'MAINTENANCE' THEN 1 ELSE 0 END)::bigint as maintenance,
          SUM(CASE WHEN rm."status" = 'RESERVED' THEN 1 ELSE 0 END)::bigint as reserved
          FROM "Room" rm JOIN "Provider" p ON p."id" = rm."providerId"
          WHERE 1=1 ${providerFilter}
          GROUP BY p."name" ORDER BY total DESC LIMIT 30`
      ),
      db.$queryRaw<{ avg: number }[]>(
        Prisma.sql`SELECT AVG(r."nights") as avg FROM "Reservation" r JOIN "Provider" p ON p."id" = r."providerId"
          WHERE r."status" NOT IN ('CANCELLED') ${dateFilter} ${providerFilter}`
      ),
      db.$queryRaw<{ rate: number }[]>(
        Prisma.sql`SELECT
          CASE WHEN COUNT(*)::float = 0 THEN 0
          ELSE (SUM(CASE WHEN rm."status" = 'OCCUPIED' THEN 1 ELSE 0 END)::float / COUNT(*)::float) * 100
          END as rate
          FROM "Room" rm JOIN "Provider" p ON p."id" = rm."providerId"
          WHERE 1=1 ${providerFilter}`
      ),
    ]);

  return {
    summary: {
      avgNights: Math.round(Number(avgNights[0]?.avg || 0) * 10) / 10,
      occupancyRate:
        Math.round(Number(avgOccupancy[0]?.rate || 0) * 10) / 10,
    },
    statusBreakdown: statusBreakdown.map((r) => ({
      name: r.status,
      value: Number(r.count),
    })),
    checkinTrend: checkinTrend.map((r) => ({
      date: String(r.date),
      count: Number(r.count),
    })),
    checkoutTrend: checkoutTrend.map((r) => ({
      date: String(r.date),
      count: Number(r.count),
    })),
    roomStatusByProvider: roomStatusByProvider.map((r) => ({
      providerName: r.providerName,
      total: Number(r.total),
      available: Number(r.available),
      occupied: Number(r.occupied),
      maintenance: Number(r.maintenance),
      reserved: Number(r.reserved),
    })),
  };
}

// ── 3. Revenue / Payment Report ──
async function revenueReport(
  dateFilter: Prisma.Sql,
  providerFilter: Prisma.Sql
): Promise<Record<string, unknown>> {
  // For revenue we filter on payment createdAt, not guest
  const payDateFrom = "";
  const payDateTo = "";
  // Re-use dateFilter for joined queries; use raw for payment-specific
  const [byMethod, byProvider, dailyRevenue, totalRevenue, avgPayment, largeCashPayments] =
    await Promise.all([
      db.$queryRaw<{ method: string; total: number; count: bigint }[]>(
        Prisma.sql`SELECT pm."method", COALESCE(SUM(pm."amount"), 0)::float as total, COUNT(*)::bigint as count
          FROM "Payment" pm JOIN "Provider" p ON p."id" = pm."providerId"
          WHERE 1=1 ${providerFilter}
          GROUP BY pm."method" ORDER BY total DESC`
      ),
      db.$queryRaw<{
        providerName: string; total: number; count: bigint;
      }[]>(
        Prisma.sql`SELECT p."name" as "providerName", COALESCE(SUM(pm."amount"), 0)::float as total, COUNT(*)::bigint as count
          FROM "Payment" pm JOIN "Provider" p ON p."id" = pm."providerId"
          WHERE 1=1 ${providerFilter}
          GROUP BY p."name" ORDER BY total DESC LIMIT 30`
      ),
      db.$queryRaw<{ date: string; total: number }[]>(
        Prisma.sql`SELECT DATE(pm."createdAt") as "date", COALESCE(SUM(pm."amount"), 0)::float as total
          FROM "Payment" pm JOIN "Provider" p ON p."id" = pm."providerId"
          WHERE pm."createdAt" >= NOW() - INTERVAL '30 days' ${providerFilter}
          GROUP BY DATE(pm."createdAt") ORDER BY "date" ASC`
      ),
      db.$queryRaw<{ total: number }[]>(
        Prisma.sql`SELECT COALESCE(SUM(pm."amount"), 0)::float as total
          FROM "Payment" pm JOIN "Provider" p ON p."id" = pm."providerId"
          WHERE 1=1 ${providerFilter}`
      ),
      db.$queryRaw<{ avg: number }[]>(
        Prisma.sql`SELECT AVG(pm."amount")::float as avg
          FROM "Payment" pm JOIN "Provider" p ON p."id" = pm."providerId"
          WHERE 1=1 ${providerFilter}`
      ),
      db.$queryRaw<{ count: bigint; total: number }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint as count, COALESCE(SUM(pm."amount"), 0)::float as total
          FROM "Payment" pm JOIN "Provider" p ON p."id" = pm."providerId"
          WHERE pm."method" = 'CASH' AND pm."amount" >= 5000 ${providerFilter}`
      ),
    ]);

  return {
    summary: {
      totalRevenue: Math.round(Number(totalRevenue[0]?.total || 0)),
      avgPayment: Math.round(Number(avgPayment[0]?.avg || 0)),
      largeCashCount: Number(largeCashPayments[0]?.count || 0),
      largeCashTotal: Math.round(
        Number(largeCashPayments[0]?.total || 0)
      ),
    },
    byMethod: byMethod.map((r) => ({
      name: r.method,
      value: Math.round(r.total),
      count: Number(r.count),
    })),
    byProvider: byProvider.map((r) => ({
      name: r.providerName,
      value: Math.round(r.total),
      count: Number(r.count),
    })),
    dailyTrend: dailyRevenue.map((r) => ({
      date: String(r.date),
      total: Math.round(r.total),
    })),
  };
}

// ── 4. Provider Compliance Report ──
async function providerComplianceReport(): Promise<Record<string, unknown>> {
  const [statusBreakdown, providers, totalRooms, totalGuests, suspendedProviders] =
    await Promise.all([
      db.$queryRaw<{ status: string; count: bigint }[]>(
        Prisma.sql`SELECT "status", COUNT(*)::bigint as count FROM "Provider" GROUP BY "status" ORDER BY count DESC`
      ),
      db.$queryRaw<{
        id: string; name: string; status: string; phone: string; address: string;
        licenseNo: string; roomCount: bigint; guestCount: bigint; userCount: bigint;
        createdAt: string;
      }[]>(
        Prisma.sql`SELECT p."id", p."name", p."status", p."phone", p."address", p."licenseNo",
          (SELECT COUNT(*)::bigint FROM "Room" r WHERE r."providerId" = p."id") as "roomCount",
          (SELECT COUNT(*)::bigint FROM "Guest" g WHERE g."providerId" = p."id") as "guestCount",
          (SELECT COUNT(*)::bigint FROM "User" u WHERE u."providerId" = p."id") as "userCount",
          p."createdAt"
          FROM "Provider" p ORDER BY p."createdAt" DESC`
      ),
      db.$queryRaw<{ c: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint as c FROM "Room"`
      ),
      db.$queryRaw<{ c: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint as c FROM "Guest"`
      ),
      db.$queryRaw<{
        id: string; name: string; suspensionReason: string; suspendedAt: string; suspendedBy: string;
      }[]>(
        Prisma.sql`SELECT "id", "name", "suspensionReason", "suspendedAt", "suspendedBy"
          FROM "Provider" WHERE "status" = 'SUSPENDED' ORDER BY "suspendedAt" DESC`
      ),
    ]);

  return {
    summary: {
      totalProviders: providers.length,
      totalRooms: Number(totalRooms[0]?.c || 0),
      totalGuests: Number(totalGuests[0]?.c || 0),
      suspendedCount: suspendedProviders.length,
    },
    statusBreakdown: statusBreakdown.map((r) => ({
      name: r.status,
      value: Number(r.count),
    })),
    providers: providers.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      phone: r.phone,
      address: r.address,
      licenseNo: r.licenseNo,
      roomCount: Number(r.roomCount),
      guestCount: Number(r.guestCount),
      userCount: Number(r.userCount),
      createdAt: r.createdAt,
    })),
    suspendedProviders: suspendedProviders.map((r) => ({
      id: r.id,
      name: r.name,
      reason: r.suspensionReason,
      suspendedAt: r.suspendedAt,
      suspendedBy: r.suspendedBy,
    })),
  };
}

// ── 5. Suspicious Activity Report ──
async function suspiciousActivityReport(
  _dateFilter: Prisma.Sql,
  providerFilter: Prisma.Sql
): Promise<Record<string, unknown>> {
  const [anomalyBySeverity, anomalyByType, recentAnomalies, suspectMatches, unreviewedCount, suspectStats] =
    await Promise.all([
      db.$queryRaw<{ severity: string; count: bigint }[]>(
        Prisma.sql`SELECT "severity", COUNT(*)::bigint as count FROM "AnomalyRecord"
          WHERE 1=1 ${providerFilter}
          GROUP BY "severity" ORDER BY count DESC`
      ),
      db.$queryRaw<{ type: string; count: bigint }[]>(
        Prisma.sql`SELECT "type", COUNT(*)::bigint as count FROM "AnomalyRecord"
          WHERE 1=1 ${providerFilter}
          GROUP BY "type" ORDER BY count DESC`
      ),
      db.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`SELECT * FROM "AnomalyRecord"
          WHERE 1=1 ${providerFilter}
          ORDER BY "riskScore" DESC, "createdAt" DESC LIMIT 50`
      ),
      db.$queryRaw<{
        id: string; guestName: string; matchType: string; providerName: string;
        isRead: boolean; createdAt: string;
      }[]>(
        Prisma.sql`SELECT sm."id", sm."guestName", sm."matchType", sm."providerName", sm."isRead", sm."createdAt"
          FROM "SuspectMatch" sm
          ORDER BY sm."createdAt" DESC LIMIT 50`
      ),
      db.$queryRaw<{ c: bigint }[]>(
        Prisma.sql`SELECT COUNT(*)::bigint as c FROM "AnomalyRecord" WHERE "isReviewed" = false`
      ),
      db.$queryRaw<{
        total: bigint; active: bigint; highCritical: bigint;
      }[]>(
        Prisma.sql`SELECT
          COUNT(*)::bigint as total,
          SUM(CASE WHEN "is_active" = true THEN 1 ELSE 0 END)::bigint as active,
          SUM(CASE WHEN "severity" IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END)::bigint as "highCritical"
          FROM "SuspectedPerson"`
      ),
    ]);

  return {
    summary: {
      totalAnomalies: anomalyBySeverity.reduce(
        (s, r) => s + Number(r.count),
        0
      ),
      unreviewedAnomalies: Number(unreviewedCount[0]?.c || 0),
      totalSuspectMatches: suspectMatches.length,
      totalSuspects: Number(suspectStats[0]?.total || 0),
      activeSuspects: Number(suspectStats[0]?.active || 0),
      highCriticalSuspects: Number(suspectStats[0]?.highCritical || 0),
    },
    anomalyBySeverity: anomalyBySeverity.map((r) => ({
      name: r.severity,
      value: Number(r.count),
    })),
    anomalyByType: anomalyByType.map((r) => ({
      name: r.type,
      value: Number(r.count),
    })),
    recentAnomalies,
    suspectMatches,
  };
}

// ── 6. Guest Movement Report ──
async function guestMovementReport(
  dateFilter: Prisma.Sql,
  providerFilter: Prisma.Sql
): Promise<Record<string, unknown>> {
  const [crossProviderGuests, frequentStayers, shortStayGuests, byRegion, byProvider] =
    await Promise.all([
      // Guests registered at multiple providers
      db.$queryRaw<{
        phone: string; name: string; providerCount: bigint; providerNames: string;
      }[]>(
        Prisma.sql`SELECT g."phone", MAX(g."name") as "name",
          COUNT(DISTINCT g."providerId")::bigint as "providerCount",
          STRING_AGG(DISTINCT p."name", ', ') as "providerNames"
          FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE g."phone" != '' AND g."phone" IS NOT NULL ${dateFilter}
          GROUP BY g."phone" HAVING COUNT(DISTINCT g."providerId") >= 2
          ORDER BY "providerCount" DESC LIMIT 50`
      ),
      // Frequent stayers (3+ reservations)
      db.$queryRaw<{
        guestName: string; guestPhone: string; stayCount: bigint; providerNames: string;
      }[]>(
        Prisma.sql`SELECT g."name" as "guestName", g."phone" as "guestPhone",
          COUNT(r."id")::bigint as "stayCount",
          STRING_AGG(DISTINCT p."name", ', ') as "providerNames"
          FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
          JOIN "Provider" p ON p."id" = r."providerId"
          WHERE r."status" != 'CANCELLED' ${dateFilter} ${providerFilter}
          GROUP BY g."name", g."phone"
          HAVING COUNT(r."id") >= 3
          ORDER BY "stayCount" DESC LIMIT 50`
      ),
      // Short-stay patterns (1-night stays, 3+)
      db.$queryRaw<{
        guestName: string; guestPhone: string; stayCount: bigint; providerNames: string;
      }[]>(
        Prisma.sql`SELECT g."name" as "guestName", g."phone" as "guestPhone",
          COUNT(r."id")::bigint as "stayCount",
          STRING_AGG(DISTINCT p."name", ', ') as "providerNames"
          FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
          JOIN "Provider" p ON p."id" = r."providerId"
          WHERE r."nights" <= 1 AND r."status" != 'CANCELLED' ${dateFilter} ${providerFilter}
          GROUP BY g."name", g."phone"
          HAVING COUNT(r."id") >= 3
          ORDER BY "stayCount" DESC LIMIT 50`
      ),
      // By region
      db.$queryRaw<{ region: string; count: bigint }[]>(
        Prisma.sql`SELECT COALESCE(NULLIF(g."region", ''), 'Unknown') as "region", COUNT(*)::bigint as count
          FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE 1=1 ${dateFilter} ${providerFilter}
          GROUP BY g."region" ORDER BY count DESC LIMIT 15`
      ),
      // By provider
      db.$queryRaw<{ providerName: string; count: bigint }[]>(
        Prisma.sql`SELECT p."name" as "providerName", COUNT(*)::bigint as count
          FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
          WHERE 1=1 ${dateFilter} ${providerFilter}
          GROUP BY p."name" ORDER BY count DESC LIMIT 15`
      ),
    ]);

  return {
    summary: {
      crossProviderGuests: crossProviderGuests.length,
      frequentStayers: frequentStayers.length,
      shortStayPatterns: shortStayGuests.length,
    },
    crossProviderGuests: crossProviderGuests.map((r) => ({
      ...r,
      providerCount: Number(r.providerCount),
    })),
    frequentStayers: frequentStayers.map((r) => ({
      ...r,
      stayCount: Number(r.stayCount),
    })),
    shortStayGuests: shortStayGuests.map((r) => ({
      ...r,
      stayCount: Number(r.stayCount),
    })),
    byRegion: byRegion.map((r) => ({
      name: r.region,
      value: Number(r.count),
    })),
    byProvider: byProvider.map((r) => ({
      name: r.providerName,
      value: Number(r.count),
    })),
  };
}
