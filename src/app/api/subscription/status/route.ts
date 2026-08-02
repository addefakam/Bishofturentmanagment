import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { calcSubscriptionStatus, TRIAL_DAYS, WARNING_DAYS, GRACE_DAYS } from "@/lib/subscription";

async function getPaymentConfig() {
  try {
    const sysSettings = await db.settings.findFirst({
      where: { providerId: null },
    });
    if (sysSettings?.configJson && typeof sysSettings.configJson === "object") {
      const config = sysSettings.configJson as Record<string, unknown>;
      const payment = config.payment;
      if (payment && typeof payment === "object") {
        return {
          trialDays: (payment as Record<string, unknown>).trialDays as number ?? TRIAL_DAYS,
          warningDays: (payment as Record<string, unknown>).warningDays as number ?? WARNING_DAYS,
          graceDays: (payment as Record<string, unknown>).graceDays as number ?? GRACE_DAYS,
          currencySymbol: (payment as Record<string, unknown>).currencySymbol as string ?? "Br",
          paymentMethod: (payment as Record<string, unknown>).paymentMethod as string ?? "manual",
          paymentInstructions: (payment as Record<string, unknown>).paymentInstructions as string ?? "",
        };
      }
    }
  } catch {
    // Fall back to defaults
  }
  return {
    trialDays: TRIAL_DAYS,
    warningDays: WARNING_DAYS,
    graceDays: GRACE_DAYS,
    currencySymbol: "Br",
    paymentMethod: "manual",
    paymentInstructions: "",
  };
}

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

    // Fetch payment config, subscription, and provider info IN PARALLEL
    const [paymentConfig, subscription, provider] = await Promise.all([
      getPaymentConfig(),
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
      trialEnd.setDate(trialEnd.getDate() + paymentConfig.trialDays);
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

    const { status, daysRemaining } = calcSubscriptionStatus(finalSub.endDate, {
      warningDays: paymentConfig.warningDays,
      graceDays: paymentConfig.graceDays,
    });

    return NextResponse.json({
      status,
      daysRemaining,
      endDate: finalSub.endDate.toISOString(),
      cycle: finalSub.cycle,
      price: finalSub.price,
      providerName: provider?.name || "",
      ownerName: provider?.ownerName || "",
      phone: provider?.phone || "",
      currencySymbol: paymentConfig.currencySymbol,
      paymentMethod: paymentConfig.paymentMethod,
      paymentInstructions: paymentConfig.paymentInstructions,
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
