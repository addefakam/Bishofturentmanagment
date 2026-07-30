import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { calcSubscriptionStatus, TRIAL_DAYS } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // SUPERUSER and POLICE are exempt from subscription checks
    if (auth.role === "SUPERUSER" || auth.role === "POLICE") {
      return NextResponse.json({ exempt: true });
    }

    if (!auth.providerId) {
      return NextResponse.json(
        { error: "No provider associated with this account" },
        { status: 400 }
      );
    }

    // Fetch subscription + provider info IN PARALLEL (was 2-4 sequential queries)
    const [subscription, provider] = await Promise.all([
      db.subscription.findFirst({ where: { providerId: auth.providerId } }),
      db.provider.findFirst({
        where: { id: auth.providerId },
        select: { name: true, ownerName: true, phone: true, status: true },
      }),
    ]);

    // Auto-create trial for APPROVED providers without subscription
    let finalSub = subscription;
    if (!subscription && provider?.status === "APPROVED") {
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
      try {
        finalSub = await db.subscription.create({
          data: { providerId: auth.providerId, startDate: now, endDate: trialEnd, cycle: "MONTHLY", price: 0 },
        });
      } catch {
        // Race condition — another request created it
        finalSub = await db.subscription.findFirst({ where: { providerId: auth.providerId } });
      }
    }

    if (!finalSub) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    const { status, daysRemaining } = calcSubscriptionStatus(finalSub.endDate);

    return NextResponse.json({
      status,
      daysRemaining,
      endDate: finalSub.endDate.toISOString(),
      cycle: finalSub.cycle,
      price: finalSub.price,
      providerName: provider?.name || "",
      ownerName: provider?.ownerName || "",
      phone: provider?.phone || "",
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch subscription status";
    const code =
      message.includes("No provider") ? 400 :
      message.includes("not found") || message.includes("No subscription") ? 404 : 500;
    return NextResponse.json({ error: message }, { status: code });
  }
}
