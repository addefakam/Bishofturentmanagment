import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { calcSubscriptionStatus, TRIAL_DAYS, WARNING_DAYS, GRACE_DAYS, type SubscriptionStatus } from "@/lib/subscription";

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
        };
      }
    }
  } catch {
    // Fall back to defaults
  }
  return { trialDays: TRIAL_DAYS, warningDays: WARNING_DAYS, graceDays: GRACE_DAYS };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);

    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse optional status filter from query params
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status")?.trim();
    const allowedStatuses = statusFilter
      ? statusFilter.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
      : null;

    // Fetch payment config and providers IN PARALLEL
    const [paymentConfig, providers] = await Promise.all([
      getPaymentConfig(),
      db.provider.findMany({
        where: { status: "APPROVED" },
        include: {
          subscription: {
            include: {
              plan: { select: { id: true, name: true } },
              payments: { select: { id: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const now = new Date();
    const results: Array<{
      providerId: string;
      providerName: string;
      ownerName: string;
      phone: string;
      email: string;
      subscriptionId: string;
      cycle: string;
      price: number;
      planId: string | null;
      planName: string | null;
      status: SubscriptionStatus;
      daysRemaining: number;
      startDate: string;
      endDate: string;
      totalPayments: number;
    }> = [];

    for (const provider of providers) {
      let subscription = provider.subscription;

      // Auto-create trial subscription for providers that don't have one
      if (!subscription) {
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + paymentConfig.trialDays);

        // Use findFirst + create pattern (no upsert for Turso)
        const existing = await db.subscription.findFirst({
          where: { providerId: provider.id },
        });

        if (!existing) {
          subscription = await db.subscription.create({
            data: {
              providerId: provider.id,
              startDate: now,
              endDate: trialEnd,
              cycle: "MONTHLY",
              price: 0,
            },
            include: {
              payments: { select: { id: true } },
            },
          });
        } else {
          subscription = existing as typeof subscription;
        }
      }

      // Calculate dynamic status
      const { status, daysRemaining } = calcSubscriptionStatus(subscription.endDate, {
        warningDays: paymentConfig.warningDays,
        graceDays: paymentConfig.graceDays,
      });

      // Build result row
      const row = {
        providerId: provider.id,
        providerName: provider.name,
        ownerName: provider.ownerName,
        phone: provider.phone,
        email: provider.email,
        subscriptionId: subscription.id,
        cycle: subscription.cycle,
        price: subscription.price,
        planId: (subscription as any).planId ?? null,
        planName: (subscription as any).plan?.name ?? null,
        status,
        daysRemaining,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate.toISOString(),
        totalPayments: subscription.payments?.length ?? 0,
      };

      results.push(row);
    }

    // Apply status filter if provided
    const filtered = allowedStatuses
      ? results.filter((r) => allowedStatuses.includes(r.status))
      : results;

    return NextResponse.json(filtered);
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to fetch subscriptions";
    const status = message.includes("denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
