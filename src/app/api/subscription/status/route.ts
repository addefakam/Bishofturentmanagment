import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/tenant";
import { calcSubscriptionStatus, TRIAL_DAYS } from "@/lib/subscription";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    // SUPERUSER and POLICE are exempt from subscription checks
    if (auth.role === "SUPERUSER" || auth.role === "POLICE") {
      return NextResponse.json({ exempt: true });
    }

    // OPERATOR and STAFF roles — use their providerId
    if (!auth.providerId) {
      return NextResponse.json(
        { error: "No provider associated with this account" },
        { status: 400 }
      );
    }

    // Find subscription by providerId
    let subscription = await db.subscription.findFirst({
      where: { providerId: auth.providerId },
    });

    // If no subscription exists, check if provider is APPROVED and auto-create trial
    if (!subscription) {
      const provider = await db.provider.findFirst({
        where: { id: auth.providerId },
      });

      if (provider && provider.status === "APPROVED") {
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

        // Use findFirst + create (no upsert for Turso)
        const existing = await db.subscription.findFirst({
          where: { providerId: auth.providerId },
        });

        if (!existing) {
          subscription = await db.subscription.create({
            data: {
              providerId: auth.providerId,
              startDate: now,
              endDate: trialEnd,
              cycle: "MONTHLY",
              price: 0,
            },
          });
        } else {
          subscription = existing;
        }
      }
    }

    if (!subscription) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    // Fetch provider info for the response
    const provider = await db.provider.findFirst({
      where: { id: auth.providerId },
      select: { name: true, ownerName: true, phone: true },
    });

    // Calculate status dynamically
    const { status, daysRemaining } = calcSubscriptionStatus(subscription.endDate);

    return NextResponse.json({
      status,
      daysRemaining,
      endDate: subscription.endDate.toISOString(),
      cycle: subscription.cycle,
      price: subscription.price,
      providerName: provider?.name || "",
      ownerName: provider?.ownerName || "",
      phone: provider?.phone || "",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch subscription status";
    const status =
      message.includes("No provider") ? 400 :
      message.includes("not found") || message.includes("No subscription") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
