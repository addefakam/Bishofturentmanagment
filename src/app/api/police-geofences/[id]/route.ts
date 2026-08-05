import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
    const { id } = await params;
    const body = await req.json();
    const { name, latitude, longitude, radius, severity, description, isActive } = body;

    const updates: string[] = [];

    if (name !== undefined) { updates.push(`"name" = ${name}`); }
    if (latitude !== undefined) { updates.push(`"latitude" = ${latitude}`); }
    if (longitude !== undefined) { updates.push(`"longitude" = ${longitude}`); }
    if (radius !== undefined) { updates.push(`"radius" = ${radius}`); }
    if (severity !== undefined) { updates.push(`"severity" = ${severity}`); }
    if (description !== undefined) { updates.push(`"description" = ${description}`); }
    if (isActive !== undefined) { updates.push(`"isActive" = ${isActive ? true : false}`); }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push(`"updatedAt" = CURRENT_TIMESTAMP`);

    await db.$executeRaw(
      Prisma.sql`UPDATE "Geofence" SET ${Prisma.sql.raw(updates.join(", "))} WHERE "id" = ${id}`
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
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }
    const { id } = await params;

    await db.$executeRaw(Prisma.sql`DELETE FROM "Geofence" WHERE "id" = ${id}`);
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
