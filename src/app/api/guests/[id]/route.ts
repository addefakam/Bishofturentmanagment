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
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "guests" });

    const { id } = await params;
    const body = await req.json();

    const existing = await db.guest.findFirst({
      where: { id, providerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    const { name, phone, email, idNumber, idType, nationality, address, notes, vip } = body;

    const guest = await db.guest.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(idNumber !== undefined && { idNumber }),
        ...(idType !== undefined && { idType }),
        ...(nationality !== undefined && { nationality }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(vip !== undefined && { vip }),
      },
    });

    return NextResponse.json(guest);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update guest";
    const status = message.includes("not found") ? 404 : message.includes("permission") || message.includes("cannot") ? 403 : 500;
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
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "guests" });

    const { id } = await params;

    const existing = await db.guest.findFirst({
      where: { id, providerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }

    // Check for active reservations (UPCOMING or ACTIVE)
    const activeReservations = await db.reservation.count({
      where: {
        guestId: id,
        status: { in: ["UPCOMING", "ACTIVE"] },
      },
    });

    if (activeReservations > 0) {
      return NextResponse.json(
        { error: "Cannot delete guest with active reservations" },
        { status: 409 }
      );
    }

    await db.guest.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete guest";
    const status = message.includes("not found") ? 404 : message.includes("active reservations") ? 409 : message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}