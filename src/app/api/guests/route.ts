import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";
import { checkSuspectMatch } from "@/lib/suspect-check";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { isPolice, providerId } = getProviderFilter(auth);

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") || "";

    const where: Record<string, unknown> = {};
    if (!isPolice) {
      where.providerId = providerId;
    }

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { idNumber: { contains: q } },
      ];
    }

    const guests = await db.guest.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(guests);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch guests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { staffOnlyWrite: true, staffPermissionKey: "guests" });

    const body = await req.json();
    const { name, phone, email, idNumber, idType, nationality, address, notes, vip } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const guest = await db.guest.create({
      data: {
        name,
        phone,
        email: email || "",
        idNumber: idNumber || "",
        idType: idType || "",
        nationality: nationality || "",
        address: address || "",
        notes: notes || "",
        vip: vip || false,
        providerId,
      },
    });

    // Background: check if guest matches any suspected person (fire-and-forget)
    checkSuspectMatch({
      name,
      phone,
      idNumber: idNumber || "",
      matchType: "GUEST_CHECKIN",
      providerId,
      extraDetails: {
        email: email || "",
        nationality: nationality || "",
        address: address || "",
      },
    }).catch(() => {});

    return NextResponse.json(guest, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create guest";
    const status = message.includes("required") ? 400 : message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}