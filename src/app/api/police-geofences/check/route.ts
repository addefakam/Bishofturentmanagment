import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/police-geofences/check
 * Body: { latitude: number, longitude: number }
 * Returns: array of breached geofences
 */
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);

    const body = await req.json();
    const { latitude, longitude } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: "latitude and longitude are required" },
        { status: 400 }
      );
    }

    const geofences = await db.geofence.findMany({
      where: { isActive: true },
    });

    const R = 6_371_000; // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const breached: {
      id: string;
      name: string;
      severity: string;
      distance: number;
      radius: number;
    }[] = [];

    for (const gf of geofences) {
      const dLat = toRad(gf.latitude - latitude);
      const dLon = toRad(gf.longitude - longitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(latitude)) *
          Math.cos(toRad(gf.latitude)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      if (distance <= gf.radius) {
        breached.push({
          id: gf.id,
          name: gf.name,
          severity: gf.severity,
          distance: Math.round(distance),
          radius: Math.round(gf.radius),
        });
      }
    }

    // Create in-app notifications for each breach
    for (const b of breached) {
      try {
        await db.notification.create({
          data: {
            title: `[GEOFENCE BREACH] ${b.name}`,
            message: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) is within ${b.distance}m of geofence zone "${b.name}" (radius: ${b.radius}m). Severity: ${b.severity}`,
            type: "WARNING",
            isRead: false,
          },
        });
      } catch {
        // Silent fail for notifications
      }
    }

    // Log the check
    await logAudit(req, {
      action: "GEOFENCE_CHECK",
      details: JSON.stringify({
        lat: latitude,
        lng: longitude,
        breaches: breached.length,
      }),
    }).catch(() => {});

    return NextResponse.json({
      checked: true,
      latitude,
      longitude,
      totalGeofences: geofences.length,
      activeGeofences: geofences.filter((g) => g.isActive).length,
      breaches: breached,
      breachCount: breached.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Geofence check failed";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
