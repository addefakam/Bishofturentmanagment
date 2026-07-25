import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "daytime" });

    const { id } = await params;
    const body = await req.json();

    const existing = await db.daytimeService.findFirst({
      where: { id, providerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const service = await db.daytimeService.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.price !== undefined && { price: Number(body.price) }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.duration !== undefined && { duration: body.duration }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.active !== undefined && { active: body.active }),
      },
    });

    return NextResponse.json(service);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update daytime service";
    const status =
      message.includes("not found") ? 404 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "daytime" });

    const { id } = await params;

    const existing = await db.daytimeService.findFirst({
      where: { id, providerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Check for existing bookings
    const bookingCount = await db.daytimeBooking.count({
      where: { serviceId: id },
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete service with existing bookings" },
        { status: 409 }
      );
    }

    await db.daytimeService.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete daytime service";
    const status =
      message.includes("not found") ? 404 :
      message.includes("Cannot delete") ? 409 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}