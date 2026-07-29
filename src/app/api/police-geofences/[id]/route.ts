import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice, AuthError } from "@/lib/tenant";
import { requirePoliceMinRank } from "@/lib/police-permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    requirePoliceMinRank(auth, "ADMIN");
    const { id } = await params;
    const body = await req.json();
    const { name, latitude, longitude, radius, severity, description, isActive } = body;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) { updates.push(`"name" = ?`); values.push(name); }
    if (latitude !== undefined) { updates.push(`"latitude" = ?`); values.push(latitude); }
    if (longitude !== undefined) { updates.push(`"longitude" = ?`); values.push(longitude); }
    if (radius !== undefined) { updates.push(`"radius" = ?`); values.push(radius); }
    if (severity !== undefined) { updates.push(`"severity" = ?`); values.push(severity); }
    if (description !== undefined) { updates.push(`"description" = ?`); values.push(description); }
    if (isActive !== undefined) { updates.push(`"isActive" = ?`); values.push(isActive ? 1 : 0); }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);
    values.push(id);

    await db.$executeRawUnsafe(
      `UPDATE "Geofence" SET ${updates.join(", ")} WHERE "id" = ?`,
      ...values
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to update geofence";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    requirePoliceMinRank(auth, "ADMIN");
    const { id } = await params;

    await db.$executeRawUnsafe(`DELETE FROM "Geofence" WHERE "id" = ?`, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to delete geofence";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
