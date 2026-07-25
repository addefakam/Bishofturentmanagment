import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";
import { checkSuspectMatch } from "@/lib/suspect-check";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { isPolice, providerId } = getProviderFilter(auth);

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const roomId = searchParams.get("roomId") || "";

    const where: Record<string, unknown> = {};
    if (!isPolice) {
      where.providerId = providerId;
    }
    if (status) {
      where.status = status;
    }
    if (roomId) {
      where.roomId = roomId;
    }
    if (dateFrom || dateTo) {
      const checkInFilter: Record<string, unknown> = {};
      if (dateFrom) checkInFilter.gte = dateFrom;
      if (dateTo) checkInFilter.lte = dateTo;
      where.checkIn = checkInFilter;
    }

    const reservations = await db.reservation.findMany({
      where,
      include: {
        guest: { select: { id: true, name: true, phone: true } },
        room: { select: { id: true, number: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reservations);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch reservations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "reservations" });

    const body = await req.json();
    const { guestId, roomId, checkIn, checkOut, roomRate, taxAmount, discountAmount, paymentMethod, notes } = body;

    if (!guestId || !roomId || !checkIn || !checkOut) {
      return NextResponse.json({ error: "guestId, roomId, checkIn, and checkOut are required" }, { status: 400 });
    }

    // Calculate nights
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const diffMs = endDate.getTime() - startDate.getTime();
    const nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    // Get room rate if not provided
    let rate = roomRate;
    if (!rate) {
      const room = await db.room.findUnique({ where: { id: roomId } });
      if (!room) {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
      rate = room.pricePerNight;
    }

    const tax = taxAmount || 0;
    const discount = discountAmount || 0;
    const subtotal = rate * nights;
    const totalCost = subtotal + tax - discount;
    const paidAmount = 0;
    const balance = totalCost - paidAmount;

    // Check for overlapping reservations on this room (double-booking prevention)
    const overlapping = await db.reservation.findFirst({
      where: {
        roomId,
        status: { in: ["UPCOMING", "ACTIVE"] },
        checkIn: { lte: checkOut },
        checkOut: { gte: checkIn },
      },
      include: {
        guest: { select: { name: true, phone: true } },
        room: { select: { number: true, name: true } },
      },
    });

    if (overlapping) {
      const roomLabel = overlapping.room.number + (overlapping.room.name ? ` (${overlapping.room.name})` : "");
      return NextResponse.json({
        error: "ROOM_CONFLICT",
        code: "ROOM_CONFLICT",
        conflict: { roomId, checkIn: overlapping.checkIn, checkOut: overlapping.checkOut, roomNumber: overlapping.room.number, roomName: overlapping.room.name },
      }, { status: 409 });
    }

    const reservation = await db.reservation.create({
      data: {
        guestId,
        roomId,
        checkIn,
        checkOut,
        nights,
        roomRate: rate,
        totalCost,
        paidAmount,
        balance,
        paymentStatus: "PENDING",
        paymentMethod: paymentMethod || null,
        status: "UPCOMING",
        notes: notes || "",
        taxAmount: tax,
        discountAmount: discount,
        providerId,
      },
      include: {
        guest: { select: { id: true, name: true, phone: true } },
        room: { select: { id: true, number: true, name: true, type: true } },
      },
    });

    // Room stays AVAILABLE until check-in date — status will be updated by checkin API

    // Background: check if guest matches any suspected person (fire-and-forget)
    checkSuspectMatch({
      name: reservation.guest.name,
      phone: reservation.guest.phone,
      matchType: "RESERVATION",
      providerId,
      reservationId: reservation.id,
      extraDetails: {
        checkIn,
        checkOut,
        nights,
        roomNumber: reservation.room.number,
        roomName: reservation.room.name,
        totalCost,
      },
    }).catch(() => {});

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create reservation";
    const status = message.includes("required") || message.includes("not found") ? 400 : message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}