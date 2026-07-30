import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, AuthError } from "@/lib/tenant";
import { calcSubscriptionStatus, TRIAL_DAYS } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const filter = getProviderFilter(auth);

    const where = filter.isPolice ? {} : { providerId: filter.providerId };

    // Today & month boundaries
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── All queries in a single Promise.all ──
    const [
      roomStatusCounts,
      activeReservations,
      todayCheckins,
      todayCheckouts,
      revenueResult,
      activityLogs,
      // Subscription + provider (combined for OPERATOR/STAFF, null otherwise)
      subResult,
    ] = await Promise.all([
      // 1. Room counts by status
      db.room.groupBy({ by: ["status"], where, _count: { status: true } }),

      // 2. Active reservations
      db.reservation.count({ where: { ...where, status: "ACTIVE" } }),

      // 3. Today check-ins
      db.reservation.count({ where: { ...where, status: "UPCOMING", checkIn: today } }),

      // 4. Today check-outs
      db.reservation.count({ where: { ...where, status: "ACTIVE", checkOut: today } }),

      // 5. Revenue aggregate
      db.reservation.aggregate({
        _sum: { paidAmount: true },
        where: { ...where, status: "COMPLETED", actualCheckOut: { gte: monthStart, lte: monthEnd } },
      }),

      // 6. Recent activity logs
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 15,
      }),

      // 7+8. Subscription + Provider info (OPERATOR/STAFF only)
      // Both fetched in parallel — no sequential .then() chains
      (auth.role !== "SUPERUSER" && auth.role !== "POLICE" && auth.providerId)
        ? (async () => {
            const [sub, prov] = await Promise.all([
              db.subscription.findFirst({ where: { providerId: auth.providerId } }),
              db.provider.findFirst({
                where: { id: auth.providerId },
                select: { name: true, ownerName: true, phone: true, status: true },
              }),
            ]);
            let finalSub = sub;
            if (!sub && prov?.status === "APPROVED") {
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
              try {
                finalSub = await db.subscription.create({
                  data: { providerId: auth.providerId, startDate: new Date(), endDate: trialEnd, cycle: "MONTHLY", price: 0 },
                });
              } catch {
                finalSub = await db.subscription.findFirst({ where: { providerId: auth.providerId } });
              }
            }
            return { subscription: finalSub, provider: prov };
          })()
        : Promise.resolve(null),
    ]);

    // Process room status
    const roomsByStatus: Record<string, number> = {
      AVAILABLE: 0, OCCUPIED: 0, MAINTENANCE: 0, RESERVED: 0,
    };
    for (const item of roomStatusCounts) {
      roomsByStatus[item.status] = item._count.status;
    }
    const totalRooms = Object.values(roomsByStatus).reduce((a, b) => a + b, 0);
    const occupancyRate = totalRooms > 0
      ? Math.round((roomsByStatus.OCCUPIED / totalRooms) * 100) : 0;

    // Build subscription response
    let subscriptionData = null as Record<string, unknown> | null;
    const subscription = subResult?.subscription;
    const providerInfo = subResult?.provider;
    if (subscription && providerInfo) {
      const { status, daysRemaining } = calcSubscriptionStatus(subscription.endDate);
      subscriptionData = {
        status,
        daysRemaining,
        endDate: subscription.endDate.toISOString(),
        cycle: subscription.cycle,
        price: subscription.price,
        providerName: providerInfo.name || "",
        ownerName: providerInfo.ownerName || "",
        phone: providerInfo.phone || "",
      };
    } else if (auth.role === "SUPERUSER" || auth.role === "POLICE") {
      subscriptionData = { exempt: true };
    }

    return NextResponse.json({
      roomsByStatus,
      totalRooms,
      activeReservations,
      todayCheckins,
      todayCheckouts,
      totalRevenue: revenueResult._sum.paidAmount || 0,
      occupancyRate,
      activity: activityLogs,
      subscription: subscriptionData,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
