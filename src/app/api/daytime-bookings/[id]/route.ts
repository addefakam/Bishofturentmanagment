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

    const existing = await db.daytimeBooking.findFirst({
      where: { id, providerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = await db.daytimeBooking.update({
      where: { id },
      data: {
        ...(body.serviceId !== undefined && { serviceId: body.serviceId }),
        ...(body.guestName !== undefined && { guestName: body.guestName }),
        ...(body.guestPhone !== undefined && { guestPhone: body.guestPhone }),
        ...(body.date !== undefined && { date: body.date }),
        ...(body.time !== undefined && { time: body.time }),
        ...(body.quantity !== undefined && { quantity: body.quantity }),
        ...(body.unitPrice !== undefined && { unitPrice: Number(body.unitPrice) }),
        ...(body.totalCost !== undefined && { totalCost: Number(body.totalCost) }),
        ...(body.paidAmount !== undefined && { paidAmount: Number(body.paidAmount) }),
        ...(body.paymentStatus !== undefined && { paymentStatus: body.paymentStatus }),
        ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
      include: {
        service: { select: { id: true, name: true, category: true } },
      },
    });

    return NextResponse.json(booking);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update daytime booking";
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

    const existing = await db.daytimeBooking.findFirst({
      where: { id, providerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    await db.daytimeBooking.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete daytime booking";
    const status =
      message.includes("not found") ? 404 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}