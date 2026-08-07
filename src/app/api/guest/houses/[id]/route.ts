import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/guest/houses/[id] - Public single guest house detail
 * Only returns APPROVED providers
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Use findFirst with status filter instead of findUnique
    // to ensure only APPROVED houses are accessible
    const house = await db.provider.findFirst({
      where: { id, status: "APPROVED" },
      select: {
        id: true,
        name: true,
        type: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        subcity: true,
        woreda: true,
        licenseNo: true,
        createdAt: true,
        rooms: {
          select: {
            id: true,
            number: true,
            name: true,
            type: true,
            pricePerNight: true,
            floor: true,
            capacity: true,
            status: true,
            amenities: true,
            description: true,
          },
          orderBy: { number: "asc" },
        },
      },
    });

    if (!house) {
      return NextResponse.json({ error: "Guest house not found" }, { status: 404 });
    }

    return NextResponse.json(house);
  } catch (error) {
    console.error("Guest house detail API error:", error);
    return NextResponse.json({ error: "Failed to fetch guest house" }, { status: 500 });
  }
}
