import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = new URL(req.url);
    const guestId = searchParams.get("guestId") || "";
    const phone = searchParams.get("phone") || "";
    const idNumber = searchParams.get("idNumber") || "";
    const name = searchParams.get("name") || "";

    // Search across all providers for matching guest reservations
    const guests = await db.guest.findMany({
      where: {
        ...(guestId ? { id: guestId } : {}),
        ...(phone ? { phone: { contains: phone } } : {}),
        ...(idNumber ? { idNumber: { contains: idNumber } } : {}),
        ...(name ? { name: { contains: name } } : {}),
      },
      include: {
        provider: { select: { id: true, name: true, address: true } },
        reservations: {
          include: { room: { select: { number: true, name: true, type: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Also check suspect matches for this guest
    const suspectMatches = await db.suspectMatch.findMany({
      where: {
        ...(phone ? { guestPhone: { contains: phone } } : {}),
        ...(idNumber ? { guestIdNumber: { contains: idNumber } } : {}),
        ...(name ? { guestName: { contains: name } } : {}),
      },
      include: { suspectedPerson: { select: { name: true, severity: true, description: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ guests, suspectMatches });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch movement data";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
