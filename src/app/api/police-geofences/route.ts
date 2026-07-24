import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    const geofences = await db.geofence.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(geofences);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch geofences";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    const body = await req.json();
    const { name, address, latitude, longitude, radius, severity } = body;
    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: "Name, latitude, and longitude are required" }, { status: 400 });
    }
    const geofence = await db.geofence.create({
      data: { name, address: address || "", latitude, longitude, radius: radius || 1000, severity: severity || "HIGH" },
    });
    return NextResponse.json(geofence, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create geofence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });
    await db.geofence.delete({ where: { id } });
    return NextResponse.json({ message: "Geofence deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete geofence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
