import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { isPolice, providerId } = getProviderFilter(auth);

    const where: Record<string, unknown> = {};
    if (!isPolice) {
      where.providerId = providerId;
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        reservation: {
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            guest: { select: { id: true, name: true, phone: true } },
            room: { select: { id: true, number: true, name: true } },
          },
        },
        daytimeBooking: {
          select: {
            id: true,
            guestName: true,
            date: true,
            service: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch payments";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "reservations" });

    const body = await req.json();
    const { reservationId, daytimeBookingId, amount, method, referenceNo, notes } = body;

    if (!amount || !method) {
      return NextResponse.json({ error: "Amount and method are required" }, { status: 400 });
    }

    if (!reservationId && !daytimeBookingId) {
      return NextResponse.json(
        { error: "Either reservationId or daytimeBookingId is required" },
        { status: 400 }
      );
    }

    const payment = await db.payment.create({
      data: {
        reservationId: reservationId || null,
        daytimeBookingId: daytimeBookingId || null,
        amount: Number(amount),
        method,
        referenceNo: referenceNo || "",
        notes: notes || "",
        providerId,
      },
    });

    // Update reservation paid amount and payment status
    if (reservationId) {
      const reservation = await db.reservation.findUnique({
        where: { id: reservationId },
      });
      if (reservation) {
        const newPaidAmount = reservation.paidAmount + Number(amount);
        const newBalance = reservation.totalCost - newPaidAmount;

        let paymentStatus: string = "PARTIAL";
        if (newBalance <= 0) {
          paymentStatus = "PAID";
        } else if (newPaidAmount <= 0) {
          paymentStatus = "PENDING";
        }

        await db.reservation.update({
          where: { id: reservationId },
          data: {
            paidAmount: newPaidAmount,
            balance: Math.max(0, newBalance),
            paymentStatus,
          },
        });
      }
    }

    // Update daytime booking paid amount and payment status
    if (daytimeBookingId) {
      const booking = await db.daytimeBooking.findUnique({
        where: { id: daytimeBookingId },
      });
      if (booking) {
        const newPaidAmount = booking.paidAmount + Number(amount);
        const newBalance = booking.totalCost - newPaidAmount;

        let paymentStatus: string = "PARTIAL";
        if (newBalance <= 0) {
          paymentStatus = "PAID";
        } else if (newPaidAmount <= 0) {
          paymentStatus = "PENDING";
        }

        await db.daytimeBooking.update({
          where: { id: daytimeBookingId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus,
          },
        });
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create payment";
    const status = message.includes("required") ? 400 : message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}