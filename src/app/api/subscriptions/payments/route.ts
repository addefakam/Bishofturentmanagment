import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Require subscriptionId query parameter
    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get("subscriptionId")?.trim();

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify subscription exists
    const subscription = await db.subscription.findFirst({
      where: { id: subscriptionId },
      select: { id: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Fetch all payments for the subscription, ordered by most recent first
    const payments = await db.subscriptionPayment.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch payments";
    const status =
      message.includes("not found") ? 404 :
      message.includes("denied") ? 403 :
      message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
