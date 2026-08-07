import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/guest/houses - Public endpoint for guest app
 * Query params: ?subcity=&woreda=&search=&page=&pageSize=
 * Only returns APPROVED providers (no licenseFile, no sensitive data)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subcity = searchParams.get("subcity") || "";
    const woreda = searchParams.get("woreda") || "";
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "12")));

    const where: Record<string, unknown> = { status: "APPROVED" };

    if (subcity) {
      where.subcity = { equals: subcity, mode: "insensitive" };
    }
    if (woreda) {
      where.woreda = { equals: woreda, mode: "insensitive" };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { type: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, houses] = await Promise.all([
      db.provider.count({ where }),
      db.provider.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          phone: true,
          email: true,
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
              capacity: true,
              status: true,
              amenities: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      houses,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Guest houses API error:", error);
    return NextResponse.json({ error: "Failed to fetch guest houses" }, { status: 500 });
  }
}
