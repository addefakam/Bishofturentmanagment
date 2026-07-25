import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  getProviderFilter,
  checkWritePermission,
} from "@/lib/tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, {
      blockSuperuser: true,
      staffPermissionKey: "resources",
    });

    const { id } = await params;
    const body = await req.json();
    const { quantity } = body;

    if (quantity == null || Number(quantity) <= 0) {
      return NextResponse.json(
        { error: "A positive quantity is required" },
        { status: 400 }
      );
    }

    const filter = getProviderFilter(auth);
    const where: Record<string, unknown> = filter.isPolice
      ? { id }
      : { id, providerId: filter.providerId };

    const existing = await db.resource.findFirst({ where });
    if (!existing) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 }
      );
    }

    const resource = await db.resource.update({
      where: { id },
      data: {
        quantity: existing.quantity + Number(quantity),
        lastRestocked: new Date(),
      },
    });

    return NextResponse.json({ resource });
  } catch (error: unknown) {
    console.error("Restock resource error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status =
      message.includes("permission") || message.includes("cannot")
        ? 403
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}