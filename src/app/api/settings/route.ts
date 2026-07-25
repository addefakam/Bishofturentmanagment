import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";

const DEFAULT_SETTINGS = {
  guestHouseName: "Guest House",
  ownerName: "",
  address: "",
  phone: "",
  email: "",
  currency: "ETB",
  taxRate: 0,
  language: "en",
  logo: null,
  checkInTime: "14:00",
  checkOutTime: "12:00",
};

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);

    const settings = await db.settings.findFirst({
      where: { providerId },
    });

    if (!settings) {
      return NextResponse.json({ ...DEFAULT_SETTINGS, providerId, id: null });
    }

    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { allowSuperuser: true });

    const body = await req.json();

    const existing = await db.settings.findFirst({
      where: { providerId },
    });

    const data = {
      guestHouseName: body.guestHouseName ?? DEFAULT_SETTINGS.guestHouseName,
      ownerName: body.ownerName ?? DEFAULT_SETTINGS.ownerName,
      address: body.address ?? DEFAULT_SETTINGS.address,
      phone: body.phone ?? DEFAULT_SETTINGS.phone,
      email: body.email ?? DEFAULT_SETTINGS.email,
      currency: body.currency ?? DEFAULT_SETTINGS.currency,
      taxRate: body.taxRate ?? DEFAULT_SETTINGS.taxRate,
      language: body.language ?? DEFAULT_SETTINGS.language,
      logo: body.logo ?? DEFAULT_SETTINGS.logo,
      checkInTime: body.checkInTime ?? DEFAULT_SETTINGS.checkInTime,
      checkOutTime: body.checkOutTime ?? DEFAULT_SETTINGS.checkOutTime,
      providerId,
    };

    let settings;
    if (existing) {
      settings = await db.settings.update({
        where: { id: existing.id },
        data,
      });
    } else {
      settings = await db.settings.create({ data });
    }

    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    const status =
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}