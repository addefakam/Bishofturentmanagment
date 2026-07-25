import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  getProviderFilter,
  checkWritePermission,
} from "@/lib/tenant";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, { staffPermissionKey: "rooms" });

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    const validStatuses = ["AVAILABLE", "OCCUPIED", "MAINTENANCE", "RESERVED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const filter = getProviderFilter(auth);
    const where: Record<string, unknown> = filter.isPolice
      ? { id }
      : { id, providerId: filter.providerId };

    const existing = await db.room.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const room = await db.room.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ room });
  } catch (error: unknown) {
    console.error("Update room status error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("permission") || message.includes("cannot")
      ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}