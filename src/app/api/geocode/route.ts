import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

/**
 * Geocode a single address using OpenStreetMap Nominatim (free, no API key).
 * Accepts: GET /api/geocode?address=...
 * Returns: { lat, lng, display_name }
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    const q = encodeURIComponent(address + ", Addis Ababa, Ethiopia");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      {
        headers: { "User-Agent": "GHMS-Police-Module/1.0" },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name as string,
    };
  } catch {
    return null;
  }
}

// GET /api/geocode?address=... — geocode a single address (useful for preview)
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address") || "";
    if (!address.trim()) {
      return NextResponse.json({ error: "address parameter is required" }, { status: 400 });
    }

    const result = await geocodeAddress(address);
    if (!result) {
      return NextResponse.json({ error: "Could not find coordinates for this address" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Geocoding failed";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/geocode — batch geocode all providers that have an address but default coordinates
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const providers = await db.provider.findMany({
      where: {
        status: "APPROVED",
        address: { not: "" },
      },
      select: { id: true, name: true, address: true, latitude: true, longitude: true },
    });

    // Filter to providers that still have default coordinates
    const DEFAULT_LAT = 9.02;
    const DEFAULT_LNG = 38.75;
    const toGeocode = providers.filter(
      (p) =>
        Math.abs(p.latitude - DEFAULT_LAT) < 0.001 &&
        Math.abs(p.longitude - DEFAULT_LNG) < 0.001 &&
        p.address.trim().length > 3,
    );

    if (toGeocode.length === 0) {
      return NextResponse.json({
        message: "All providers already have coordinates set. No geocoding needed.",
        updated: 0,
        skipped: providers.length,
      });
    }

    let updated = 0;
    let failed = 0;
    const results: { name: string; address: string; lat?: number; lng?: number; error?: string }[] = [];

    // Process sequentially to respect Nominatim rate limit (1 req/sec)
    for (const provider of toGeocode) {
      const geo = await geocodeAddress(provider.address);
      if (geo) {
        await db.provider.update({
          where: { id: provider.id },
          data: { latitude: geo.lat, longitude: geo.lng },
        });
        updated++;
        results.push({ name: provider.name, address: provider.address, lat: geo.lat, lng: geo.lng });
      } else {
        failed++;
        results.push({ name: provider.name, address: provider.address, error: "Not found" });
      }
      // Respect Nominatim rate limit
      await new Promise((r) => setTimeout(r, 1100));
    }

    return NextResponse.json({
      message: `Geocoded ${updated} of ${toGeocode.length} providers.`,
      updated,
      failed,
      total: toGeocode.length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Batch geocoding failed";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
