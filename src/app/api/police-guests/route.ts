import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") || "";

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { idNumber: { contains: q } },
      ];
    }

    const guests = await db.guest.findMany({
      where,
      include: {
        provider: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    logAudit(req, { action: "VIEW_GUESTS", details: q ? `Search: ${q}` : "Viewed all guests" });
    return NextResponse.json(guests);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to search guests";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}