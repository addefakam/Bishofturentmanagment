import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/tenant";
import { calcNextEndDate, CYCLE_DAYS, TRIAL_DAYS } from "@/lib/subscription";
import { logAudit } from "@/lib/audit";

const VALID_CYCLES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);

    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { amount, cycle, notes } = body;

    // Find subscription by id
    const subscription = await db.subscription.findFirst({
      where: { id },
    });
    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Determine amount and cycle — use provided values or fall back to current
    const paymentAmount = amount !== undefined ? Number(amount) : subscription.price;
    const newCycle = cycle && VALID_CYCLES.includes(cycle) ? cycle : subscription.cycle;

    if (paymentAmount < 0) {
      return NextResponse.json(
        { error: "Payment amount cannot be negative" },
        { status: 400 }
      );
    }

    // Calculate period boundaries
    const now = new Date();
    const currentEnd = new Date(subscription.endDate);
    const periodStart = new Date(Math.max(now.getTime(), currentEnd.getTime()));
    const periodEnd = calcNextEndDate(currentEnd, newCycle);

    // Update subscription: new period dates, cycle, and price
    const updatedSubscription = await db.subscription.update({
      where: { id },
      data: {
        startDate: periodStart,
        endDate: periodEnd,
        cycle: newCycle,
        price: paymentAmount,
      },
    });

    // Create payment record
    const payment = await db.subscriptionPayment.create({
      data: {
        subscriptionId: id,
        amount: paymentAmount,
        cycle: newCycle,
        periodStart,
        periodEnd,
        markedBy: auth.userId,
        notes: notes || "",
      },
    });

    // Log audit trail
    await logAudit(req, {
      action: "SUBSCRIPTION_PAYMENT",
      targetId: id,
      targetType: "Subscription",
      details: `Payment of ${paymentAmount} ETB recorded for ${newCycle} cycle. Period: ${periodStart.toISOString()} → ${periodEnd.toISOString()}. Notes: ${notes || "none"}`,
    });

    return NextResponse.json({
      subscription: updatedSubscription,
      payment,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record payment";
    const status =
      message.includes("not found") ? 404 :
      message.includes("denied") ? 403 :
      message.includes("cannot be negative") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
