import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";

const VALID_CYCLES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"] as const;

export async function PUT(
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
    const { name, cycle, price, isActive } = body;

    const existing = await db.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: "Plan name cannot be empty" }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (cycle !== undefined) {
      if (!VALID_CYCLES.includes(cycle)) {
        return NextResponse.json(
          { error: `Invalid cycle. Must be one of: ${VALID_CYCLES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.cycle = cycle;
    }
    if (price !== undefined) {
      if (Number(price) < 0) {
        return NextResponse.json({ error: "Price must be non-negative" }, { status: 400 });
      }
      updateData.price = Number(price);
    }
    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(plan);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to update plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Soft-delete: set isActive=false if there are active subscriptions
    if (existing._count.subscriptions > 0) {
      const deactivated = await db.subscriptionPlan.update({
        where: { id },
        data: { isActive: false },
      });
      return NextResponse.json({
        ...deactivated,
        message: "Plan has active subscriptions. It has been deactivated instead of deleted.",
      });
    }

    // Hard delete if no subscriptions use it
    await db.subscriptionPlan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to delete plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
