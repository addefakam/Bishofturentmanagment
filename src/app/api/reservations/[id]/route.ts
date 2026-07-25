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
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "reservations" });

    const { id } = await params;
    const body = await req.json();

    const existing = await db.reservation.findFirst({
      where: { id, providerId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    const { guestId, roomId, checkIn, checkOut, roomRate, taxAmount, discountAmount, paymentMethod, notes, status } = body;

    // Recalculate if dates or rates changed
    let nights = existing.nights;
    let totalCost = existing.totalCost;
    let balance = existing.balance;

    const newCheckIn = checkIn || existing.checkIn;
    const newCheckOut = checkOut || existing.checkOut;
    const newRate = roomRate !== undefined ? roomRate : existing.roomRate;
    const newTax = taxAmount !== undefined ? taxAmount : existing.taxAmount;
    const newDiscount = discountAmount !== undefined ? discountAmount : existing.discountAmount;

    if (checkIn || checkOut || roomRate !== undefined) {
      const startDate = new Date(newCheckIn);
      const endDate = new Date(newCheckOut);
      const diffMs = endDate.getTime() - startDate.getTime();
      nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const subtotal = newRate * nights;
      totalCost = subtotal + newTax - newDiscount;
      balance = totalCost - existing.paidAmount;
    }

    const reservation = await db.reservation.update({
      where: { id },
      data: {
        ...(guestId !== undefined && { guestId }),
        ...(roomId !== undefined && { roomId }),
        ...(checkIn !== undefined && { checkIn }),
        ...(checkOut !== undefined && { checkOut }),
        nights,
        roomRate: newRate,
        totalCost,
        balance,
        ...(taxAmount !== undefined && { taxAmount }),
        ...(discountAmount !== undefined && { discountAmount }),
        ...(paymentMethod !== undefined && { paymentMethod: paymentMethod || null }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
      },
      include: {
        guest: { select: { id: true, name: true, phone: true } },
        room: { select: { id: true, number: true, name: true, type: true } },
      },
    });

    return NextResponse.json(reservation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update reservation";
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
    checkWritePermission(auth, { requireSuperuserOrOperator: true });

    const { id } = await params;

    const existing = await db.reservation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // If room was RESERVED, set it back to AVAILABLE
    if (existing.status === "UPCOMING") {
      await db.room.update({
        where: { id: existing.roomId },
        data: { status: "AVAILABLE" },
      });
    }

    await db.reservation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete reservation";
    const status = message.includes("not found") ? 404 : message.includes("permission") || message.includes("cannot") || message.includes("required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}