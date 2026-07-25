import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";
import { checkSuspectMatch } from "@/lib/suspect-check";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);

    const { searchParams } = req.nextUrl;
    const date = searchParams.get("date");

    const where: Record<string, unknown> = { providerId };
    if (date) where.date = date;

    const bookings = await db.daytimeBooking.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(bookings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch daytime bookings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "daytime" });

    if (!providerId) {
      return NextResponse.json({ error: "No provider assigned" }, { status: 403 });
    }

    const body = await req.json();
    const {
      serviceId, guestName, guestPhone, date, time,
      quantity, unitPrice, totalCost, paidAmount,
      paymentStatus, paymentMethod, notes,
    } = body;

    if (!serviceId || !guestName || !date || !time) {
      return NextResponse.json(
        { error: "serviceId, guestName, date, and time are required" },
        { status: 400 }
      );
    }

    const booking = await db.daytimeBooking.create({
      data: {
        serviceId,
        guestName,
        guestPhone: guestPhone || "",
        date,
        time,
        quantity: quantity || 1,
        unitPrice: Number(unitPrice) || 0,
        totalCost: Number(totalCost) || 0,
        paidAmount: Number(paidAmount) || 0,
        paymentStatus: paymentStatus || "PENDING",
        paymentMethod: paymentMethod || null,
        notes: notes || "",
        providerId,
      },
      include: {
        service: { select: { id: true, name: true, category: true } },
      },
    });

    // Background: check if guest matches any suspected person (fire-and-forget)
    checkSuspectMatch({
      name: guestName,
      phone: guestPhone || "",
      matchType: "DAYTIME_BOOKING",
      providerId,
      daytimeBookingId: booking.id,
      extraDetails: {
        date,
        time,
        quantity,
        serviceName: booking.service.name,
        totalCost,
      },
    }).catch(() => {});

    return NextResponse.json(booking, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create daytime booking";
    const status =
      message.includes("required") ? 400 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}