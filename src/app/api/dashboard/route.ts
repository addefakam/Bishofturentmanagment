import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, AuthError } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    const filter = getProviderFilter(auth);

    const where = filter.isPolice ? {} : { providerId: filter.providerId };

    // Today & month boundaries (computed once, reused across queries)
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── All 5 queries run in parallel (no data dependencies) ──
    const [
      roomStatusCounts,
      activeReservations,
      todayCheckins,
      todayCheckouts,
      revenueResult,
    ] = await Promise.all([
      // 1. Room counts by status
      db.room.groupBy({
        by: ["status"],
        where,
        _count: { status: true },
      }),

      // 2. Active reservations count
      db.reservation.count({
        where: { ...where, status: "ACTIVE" },
      }),

      // 3. Today's check-ins
      db.reservation.count({
        where: { ...where, status: "UPCOMING", checkIn: today },
      }),

      // 4. Today's check-outs
      db.reservation.count({
        where: { ...where, status: "ACTIVE", checkOut: today },
      }),

      // 5. Revenue — use aggregate instead of findMany + JS reduce
      db.reservation.aggregate({
        _sum: { paidAmount: true },
        where: {
          ...where,
          status: "COMPLETED",
          actualCheckOut: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

    // Process room status counts
    const roomsByStatus: Record<string, number> = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      MAINTENANCE: 0,
      RESERVED: 0,
    };
    for (const item of roomStatusCounts) {
      roomsByStatus[item.status] = item._count.status;
    }

    const totalRooms = Object.values(roomsByStatus).reduce((a, b) => a + b, 0);

    // Occupancy rate = occupied rooms / total rooms
    const occupancyRate =
      totalRooms > 0
        ? Math.round((roomsByStatus.OCCUPIED / totalRooms) * 100)
        : 0;

    return NextResponse.json({
      roomsByStatus,
      totalRooms,
      activeReservations,
      todayCheckins,
      todayCheckouts,
      totalRevenue: revenueResult._sum.paidAmount || 0,
      occupancyRate,
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
