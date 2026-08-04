import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { calcSubscriptionStatus, TRIAL_DAYS, WARNING_DAYS, GRACE_DAYS } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // Only OPERATOR and STAFF can access their own bill
    if (auth.role !== "OPERATOR" && auth.role !== "STAFF") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!auth.providerId) {
      return NextResponse.json(
        { error: "No provider associated with this account" },
        { status: 400 }
      );
    }

    // Fetch provider, rooms (for total beds), and subscription in parallel
    const [provider, rooms, subscription] = await Promise.all([
      db.provider.findFirst({
        where: { id: auth.providerId },
        select: { name: true, ownerName: true, phone: true, status: true },
      }),
      db.room.findMany({
        where: { providerId: auth.providerId },
        select: { capacity: true },
      }),
      db.subscription.findFirst({ where: { providerId: auth.providerId } }),
    ]);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Calculate total beds from room capacities
    const totalBeds = rooms.reduce((sum, r) => sum + (r.capacity || 0), 0);

    if (!subscription) {
      return NextResponse.json({
        providerName: provider.name,
        ownerName: provider.ownerName,
        phone: provider.phone,
        totalBeds,
        subscription: null,
        payments: [],
      });
    }

    const { status, daysRemaining } = calcSubscriptionStatus(subscription.endDate, {
      warningDays: WARNING_DAYS,
      graceDays: GRACE_DAYS,
    });

    // Fetch payment history for this subscription
    const payments = await db.subscriptionPayment.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
    });

    // Total amount paid
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return NextResponse.json({
      providerName: provider.name,
      ownerName: provider.ownerName,
      phone: provider.phone,
      totalBeds,
      subscription: {
        id: subscription.id,
        status,
        daysRemaining,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate.toISOString(),
        cycle: subscription.cycle,
        price: subscription.price,
      },
      payments,
      totalPaid,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch bill information";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
