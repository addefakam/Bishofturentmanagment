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

    const filter = getProviderFilter(auth);
    const where: Record<string, unknown> = filter.isPolice
      ? { id }
      : { id, providerId: filter.providerId };

    const existing = await db.room.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // If room number is being changed, check for duplicates
    if (body.number && body.number !== existing.number) {
      const dup = await db.room.findFirst({
        where: {
          number: body.number,
          providerId: existing.providerId,
          NOT: { id },
        },
      });
      if (dup) {
        return NextResponse.json(
          { error: "Room number already exists for this provider" },
          { status: 409 }
        );
      }
    }

    const room = await db.room.update({
      where: { id },
      data: {
        ...(body.number !== undefined && { number: body.number }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.pricePerNight !== undefined && {
          pricePerNight: Number(body.pricePerNight),
        }),
        ...(body.floor !== undefined && { floor: Number(body.floor) }),
        ...(body.capacity !== undefined && {
          capacity: Number(body.capacity),
        }),
        ...(body.amenities !== undefined && { amenities: body.amenities }),
        ...(body.description !== undefined && {
          description: body.description,
        }),
        ...(body.image !== undefined && { image: body.image }),
      },
    });

    return NextResponse.json({ room });
  } catch (error: unknown) {
    console.error("Update room error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("permission") || message.includes("cannot")
      ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, { staffPermissionKey: "rooms" });

    const { id } = await params;

    const filter = getProviderFilter(auth);
    const where: Record<string, unknown> = filter.isPolice
      ? { id }
      : { id, providerId: filter.providerId };

    const existing = await db.room.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Prevent deleting rooms that have active reservations
    const activeReservation = await db.reservation.findFirst({
      where: {
        roomId: id,
        status: { in: ["UPCOMING", "ACTIVE"] },
      },
    });
    if (activeReservation) {
      return NextResponse.json(
        { error: "Cannot delete room with active or upcoming reservations" },
        { status: 409 }
      );
    }

    await db.room.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete room error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("permission") || message.includes("cannot")
      ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}