import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, blockPoliceWrites } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { isPolice, providerId } = getProviderFilter(auth);

    const { searchParams } = req.nextUrl;
    const reservationId = searchParams.get("reservationId");

    const where: Record<string, unknown> = {};
    if (isPolice) {
      if (reservationId) where.reservationId = reservationId;
    } else {
      where.reservationId = reservationId || undefined;
    }

    // For non-police, only show reviews for reservations belonging to their provider
    if (!isPolice && !reservationId) {
      const reservations = await db.reservation.findMany({
        where: { providerId },
        select: { id: true },
      });
      where.reservationId = { in: reservations.map((r) => r.id) };
    } else if (!isPolice && reservationId) {
      // Verify the reservation belongs to this provider
      const reservation = await db.reservation.findFirst({
        where: { id: reservationId, providerId },
      });
      if (!reservation) {
        return NextResponse.json([]);
      }
    }

    const reviews = await db.review.findMany({
      where,
      include: {
        guest: { select: { id: true, name: true } },
        reservation: { select: { id: true, checkIn: true, checkOut: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reviews);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch reviews";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    blockPoliceWrites(auth);

    const body = await req.json();
    const { guestId, reservationId, rating, comment } = body;

    if (!guestId || !reservationId || rating == null) {
      return NextResponse.json(
        { error: "guestId, reservationId, and rating are required" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const review = await db.review.create({
      data: {
        guestId,
        reservationId,
        rating: Number(rating),
        comment: comment || "",
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create review";
    const status =
      message.includes("required") || message.includes("between") ? 400 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}