import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { CYCLE_DAYS } from "@/lib/subscription";

const VALID_CYCLES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const;

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const plans = await db.subscriptionPlan.findMany({
      include: {
        _count: { select: { subscriptions: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Add computed fields and sort by cycle duration
    const enriched = plans.map((p) => {
      const days = CYCLE_DAYS[p.cycle] || 30;
      const months = days / 30;
      return {
        ...p,
        days,
        months,
        perMonth: months > 0 ? Math.round((p.price / months) * 100) / 100 : p.price,
        subscriptionCount: p._count.subscriptions,
      };
    });

    // Sort by cycle order: MONTHLY, QUARTERLY, SEMI_ANNUAL, YEARLY
    const cycleOrder: Record<string, number> = {
      MONTHLY: 0,
      QUARTERLY: 1,
      SEMI_ANNUAL: 2,
      YEARLY: 3,
    };
    enriched.sort((a, b) => (cycleOrder[a.cycle] ?? 99) - (cycleOrder[b.cycle] ?? 99));

    return NextResponse.json(enriched);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch plans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const { name, cycle, price } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Plan name is required" }, { status: 400 });
    }
    if (!cycle || !VALID_CYCLES.includes(cycle)) {
      return NextResponse.json(
        { error: `Invalid cycle. Must be one of: ${VALID_CYCLES.join(", ")}` },
        { status: 400 }
      );
    }
    if (price === undefined || price === null || Number(price) < 0) {
      return NextResponse.json({ error: "Price must be a non-negative number" }, { status: 400 });
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name: name.trim(),
        cycle,
        price: Number(price),
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to create plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
