import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 5;

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)))
    );
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { idNumber: { contains: q } },
      ];
    }

    const [guests, total] = await Promise.all([
      db.guest.findMany({
        where,
        include: {
          provider: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.guest.count({ where }),
    ]);

    logAudit(req, { action: "VIEW_GUESTS", details: q ? `Search: ${q} (page ${page})` : `Viewed guests page ${page}` });

    return NextResponse.json({
      guests,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search guests";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
