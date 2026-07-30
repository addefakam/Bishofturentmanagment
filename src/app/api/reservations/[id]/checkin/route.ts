import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission, AuthError } from "@/lib/tenant";
import { runAnomalyDetection } from "@/lib/anomaly-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "reservations", staffCanCreate: true });

    const { id } = await params;
    const { providerId } = getProviderFilter(auth);

    const reservation = await db.reservation.findFirst({ where: { id, providerId } });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status !== "UPCOMING") {
      return NextResponse.json(
        { error: `Cannot check in a reservation with status '${reservation.status}'` },
        { status: 409 }
      );
    }

    const now = new Date();

    // Update reservation status and actual check-in time
    const updated = await db.reservation.update({
      where: { id },
      data: {
        status: "ACTIVE",
        actualCheckIn: now,
      },
      include: {
        guest: { select: { id: true, name: true, phone: true } },
        room: { select: { id: true, number: true, name: true, type: true } },
      },
    });

    // Update room status to OCCUPIED
    await db.room.update({
      where: { id: reservation.roomId },
      data: { status: "OCCUPIED" },
    });

    // Background: run anomaly detection on check-in (fire-and-forget)
    runAnomalyDetection({
      guestName: updated.guest.name,
      guestPhone: updated.guest.phone,
      providerId,
      reservationId: id,
      trigger: "CHECKIN",
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to check in";
    const status = message.includes("not found") ? 404 : message.includes("Cannot check in") ? 409 : message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}