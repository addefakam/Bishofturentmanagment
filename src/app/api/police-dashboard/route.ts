import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);

    // City-wide stats
    const totalProviders = await db.provider.count();
    const totalRooms = await db.room.count();
    const totalGuests = await db.guest.count();
    const activeReservations = await db.reservation.count({
      where: { status: { in: ["UPCOMING", "ACTIVE"] } },
    });

    const revenueResult = await db.reservation.aggregate({
      _sum: { paidAmount: true },
    });

    const daytimeRevenueResult = await db.daytimeBooking.aggregate({
      _sum: { paidAmount: true },
    });

    const revenue = (revenueResult._sum.paidAmount || 0) + (daytimeRevenueResult._sum.paidAmount || 0);

    // Per-provider breakdown
    const providers = await db.provider.findMany({
      include: {
        _count: {
          select: {
            rooms: true,
            guests: true,
            reservations: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const providerBreakdown = await Promise.all(
      providers.map(async (p) => {
        const activeRes = await db.reservation.count({
          where: { providerId: p.id, status: { in: ["UPCOMING", "ACTIVE"] } },
        });
        const paidResult = await db.reservation.aggregate({
          where: { providerId: p.id },
          _sum: { paidAmount: true },
        });
        const daytimePaidResult = await db.daytimeBooking.aggregate({
          where: { providerId: p.id },
          _sum: { paidAmount: true },
        });
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          rooms: p._count.rooms,
          guests: p._count.guests,
          totalReservations: p._count.reservations,
          activeReservations: activeRes,
          revenue: (paidResult._sum.paidAmount || 0) + (daytimePaidResult._sum.paidAmount || 0),
        };
      })
    );

    return NextResponse.json({
      totalProviders,
      totalRooms,
      totalGuests,
      activeReservations,
      revenue,
      providers: providerBreakdown,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch police dashboard";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}