import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission, AuthError } from "@/lib/tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "reservations", staffCanCreate: true });

    const { id } = await params;
    const { providerId } = getProviderFilter(auth);

    const reservation = await db.reservation.findFirst({
      where: { id, providerId },
      include: { room: { select: { id: true, status: true } } },
    });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status === "COMPLETED" || reservation.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Cannot cancel a reservation with status '${reservation.status}'` },
        { status: 409 }
      );
    }

    // Update reservation status to CANCELLED
    const updated = await db.reservation.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
      include: {
        guest: { select: { id: true, name: true, phone: true } },
        room: { select: { id: true, number: true, name: true, type: true } },
      },
    });

    // If room was RESERVED, set it back to AVAILABLE
    if (reservation.room.status === "RESERVED") {
      await db.room.update({
        where: { id: reservation.roomId },
        data: { status: "AVAILABLE" },
      });
    }

    return NextResponse.json(updated);
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to cancel reservation";
    const status = message.includes("not found") ? 404 : message.includes("Cannot cancel") ? 409 : message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}