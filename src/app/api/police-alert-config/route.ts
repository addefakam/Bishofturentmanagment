import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    let config = await db.policeAlertConfig.findFirst();
    if (!config) {
      config = await db.policeAlertConfig.create({ data: {} });
    }
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch alert config";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    const body = await req.json();
    let config = await db.policeAlertConfig.findFirst();
    if (!config) {
      config = await db.policeAlertConfig.create({ data: body });
    } else {
      config = await db.policeAlertConfig.update({ where: { id: config.id }, data: body });
    }
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update alert config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
