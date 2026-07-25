import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);

    const services = await db.daytimeService.findMany({
      where: { providerId },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(services);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch daytime services";
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
    const { name, price, category, duration, description, active } = body;

    if (!name || price == null) {
      return NextResponse.json(
        { error: "name and price are required" },
        { status: 400 }
      );
    }

    const service = await db.daytimeService.create({
      data: {
        name,
        price: Number(price),
        category: category || "",
        duration: duration || "",
        description: description || "",
        active: active !== false,
        providerId,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create daytime service";
    const status =
      message.includes("required") ? 400 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}