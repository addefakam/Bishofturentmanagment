import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAuthContext,
  getProviderFilter,
  checkWritePermission,
} from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const filter = getProviderFilter(auth);

    const where: Record<string, unknown> = filter.isPolice
      ? {}
      : { providerId: filter.providerId };

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    if (q) {
      where.OR = [
        { number: { contains: q } },
        { name: { contains: q } },
      ];
    }

    const rooms = await db.room.findMany({
      where,
      orderBy: { floor: "asc" },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("List rooms error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, { staffPermissionKey: "rooms" });

    if (!auth.providerId) {
      return NextResponse.json(
        { error: "No provider assigned to this user" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // ── Bulk import ──────────────────────────────────────────────────────────
    if (Array.isArray(body.bulk)) {
      const results: { number: string; status: string; error?: string }[] = [];

      for (const row of body.bulk) {
        const { number, type, pricePerNight, floor, capacity, amenities, description, name } = row;
        if (!number || !type || pricePerNight == null || floor == null || capacity == null) {
          results.push({ number: String(number ?? "?"), status: "skipped", error: "Missing required fields" });
          continue;
        }
        try {
          const existing = await db.room.findFirst({ where: { number: String(number), providerId: auth.providerId } });
          if (existing) {
            results.push({ number: String(number), status: "skipped", error: "Room number already exists" });
            continue;
          }
          await db.room.create({
            data: {
              number: String(number),
              name: name ? String(name) : `Room ${number}`,
              type: String(type).toUpperCase(),
              pricePerNight: Number(pricePerNight),
              floor: Number(floor),
              capacity: Number(capacity),
              amenities: amenities ? JSON.stringify(String(amenities).split(",").map((s: string) => s.trim()).filter(Boolean)) : "[]",
              description: description ? String(description) : "",
              providerId: auth.providerId,
            },
          });
          results.push({ number: String(number), status: "created" });
        } catch {
          results.push({ number: String(number), status: "error", error: "Database error" });
        }
      }

      const created = results.filter((r) => r.status === "created").length;
      const skipped = results.filter((r) => r.status !== "created").length;
      return NextResponse.json({ imported: created, skipped, results }, { status: 200 });
    }

    // ── Single room create ───────────────────────────────────────────────────
    const {
      number,
      name,
      type,
      pricePerNight,
      floor,
      capacity,
      amenities,
      description,
      image,
    } = body;

    if (!number || !type || pricePerNight == null || floor == null || capacity == null) {
      return NextResponse.json(
        { error: "Missing required fields: number, type, pricePerNight, floor, capacity" },
        { status: 400 }
      );
    }

    // Check for duplicate room number within the same provider
    const existing = await db.room.findFirst({
      where: { number, providerId: auth.providerId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Room number already exists for this provider" },
        { status: 409 }
      );
    }

    const room = await db.room.create({
      data: {
        number,
        name: name || `Room ${number}`,   // auto-generate name if omitted
        type,
        pricePerNight: Number(pricePerNight),
        floor: Number(floor),
        capacity: Number(capacity),
        amenities: amenities || "[]",
        description: description || "",
        image: image || null,
        providerId: auth.providerId,
      },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create room error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("permission") || message.includes("cannot")
      ? 403
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}