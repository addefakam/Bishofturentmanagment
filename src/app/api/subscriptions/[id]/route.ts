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
    const { price, cycle } = body;

    // Validate cycle if provided
    if (cycle !== undefined && !VALID_CYCLES.includes(cycle)) {
      return NextResponse.json(
        { error: "Invalid cycle. Must be MONTHLY, QUARTERLY, SEMI_ANNUAL, or YEARLY" },
        { status: 400 }
      );
    }

    // Validate price if provided
    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return NextResponse.json(
        { error: "Price must be a non-negative number" },
        { status: 400 }
      );
    }

    // Find subscription by id
    const existing = await db.subscription.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (price !== undefined) updateData.price = price;
    if (cycle !== undefined) updateData.cycle = cycle;

    // Update subscription
    const updated = await db.subscription.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to update subscription";
    const status =
      message.includes("not found") ? 404 :
      message.includes("denied") ? 403 :
      message.includes("Invalid") || message.includes("Price must") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
