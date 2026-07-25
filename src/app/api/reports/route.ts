import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);

    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    // Fetch reservations in date range
    const reservations = await db.reservation.findMany({
      where: {
        providerId,
        ...(from || to ? { checkIn: dateFilter } : {}),
      },
      include: {
        guest: { select: { id: true, name: true, phone: true, email: true, idNumber: true, idType: true, nationality: true, address: true, notes: true, vip: true, createdAt: true } },
        room: { select: { number: true, name: true, type: true } },
      },
      orderBy: { checkIn: "desc" },
    });

    // Fetch expenses in date range
    const expenses = await db.expense.findMany({
      where: {
        providerId,
        ...(from || to ? { date: dateFilter } : {}),
      },
    });

    // Fetch daytime bookings in date range
    const daytimeBookings = await db.daytimeBooking.findMany({
      where: {
        providerId,
        ...(from || to ? { date: dateFilter } : {}),
      },
    });

    // Calculate totals
    const reservationRevenue = reservations.reduce((sum, r) => sum + r.paidAmount, 0);
    const daytimeRevenue = daytimeBookings.reduce((sum, b) => sum + b.paidAmount, 0);
    const revenue = reservationRevenue + daytimeRevenue;
    const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const profit = revenue - expensesTotal;

    // Occupancy rate
    const totalRooms = await db.room.count({ where: { providerId } });
    const occupiedRooms = await db.room.count({
      where: { providerId, status: "OCCUPIED" },
    });
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;



    // Active guests (OCCUPIED + RESERVED) — not filtered by date range
    const activeGuests = await db.reservation.findMany({
      where: {
        providerId,
        status: { in: ["ACTIVE", "UPCOMING"] },
      },
      include: {
        guest: { select: { id: true, name: true, phone: true, email: true, idNumber: true, idType: true, nationality: true, address: true, notes: true, vip: true, createdAt: true } },
        room: { select: { number: true, name: true, type: true } },
      },
      orderBy: { checkIn: "desc" },
    });
    // Expense breakdown by category
    const expenseMap = new Map<string, number>();
    for (const e of expenses) {
      expenseMap.set(e.category, (expenseMap.get(e.category) || 0) + e.amount);
    }
    const expenseBreakdown = Array.from(expenseMap.entries()).map(
      ([category, amount]) => ({ category, amount })
    );

    // Daily revenue
    const dailyMap = new Map<string, number>();
    for (const r of reservations) {
      const day = r.checkIn;
      if (day) {
        dailyMap.set(day, (dailyMap.get(day) || 0) + r.paidAmount);
      }
    }
    for (const b of daytimeBookings) {
      const day = b.date;
      if (day) {
        dailyMap.set(day, (dailyMap.get(day) || 0) + b.paidAmount);
      }
    }
    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      revenue,
      expenses: expensesTotal,
      profit,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      reservations,
      activeGuests,
      expenseBreakdown,
      dailyRevenue,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}