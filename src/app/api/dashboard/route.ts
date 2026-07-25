import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const filter = getProviderFilter(auth);

    const where = filter.isPolice ? {} : { providerId: filter.providerId };

    // Count rooms by status
    const roomStatusCounts = await db.room.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

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

    // Active reservations
    const activeReservations = await db.reservation.count({
      where: { ...where, status: "ACTIVE" },
    });

    // Today's check-ins and check-outs
    const today = new Date().toISOString().split("T")[0];

    const todayCheckins = await db.reservation.count({
      where: {
        ...where,
        status: "UPCOMING",
        checkIn: today,
      },
    });

    const todayCheckouts = await db.reservation.count({
      where: {
        ...where,
        status: "ACTIVE",
        checkOut: today,
      },
    });

    // Revenue this month from completed reservations
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const completedThisMonth = await db.reservation.findMany({
      where: {
        ...where,
        status: "COMPLETED",
        actualCheckOut: {
          gte: new Date(monthStart),
          lte: new Date(monthEnd + "T23:59:59.999Z"),
        },
      },
      select: { paidAmount: true, totalCost: true },
    });

    const totalRevenue = completedThisMonth.reduce(
      (sum, r) => sum + r.paidAmount,
      0
    );

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
      totalRevenue,
      occupancyRate,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}