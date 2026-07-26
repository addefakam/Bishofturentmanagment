import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") || "";

    // 1. Cross-provider guest movement tracker
    let linkedGuests: unknown[] = [];
    if (q) {
      linkedGuests = await db.$queryRawUnsafe(
        `SELECT g.*, p."name" as "providerName", p."id" as "providerId"
        FROM "Guest" g
        JOIN "Provider" p ON g."providerId" = p."id"
        WHERE g."phone" LIKE ? OR g."idNumber" LIKE ? OR g."name" LIKE ?
        ORDER BY g."createdAt" DESC
        LIMIT 100`,
        `%${q}%`, `%${q}%`, `%${q}%`
      );
    }

    // 2. Guest linking graph — same phone or ID across providers
    const linkingData = await db.$queryRawUnsafe(
      `SELECT
        g."phone",
        g."idNumber",
        COUNT(DISTINCT g."providerId") as providerCount,
        GROUP_CONCAT(DISTINCT g."id") as guestIds,
        GROUP_CONCAT(DISTINCT g."name") as names,
        GROUP_CONCAT(DISTINCT p."name") as providerNames
      FROM "Guest" g
      JOIN "Provider" p ON g."providerId" = p."id"
      WHERE (g."phone" != '' AND g."phone" IS NOT NULL) OR (g."idNumber" != '' AND g."idNumber" IS NOT NULL)
      GROUP BY COALESCE(g."phone", 'no-phone'), COALESCE(g."idNumber", 'no-id')
      HAVING providerCount > 1
      ORDER BY providerCount DESC
      LIMIT 50`
    );

    // 3. Frequent stay patterns
    const frequentPatterns = await db.$queryRawUnsafe(
      `SELECT
        g."id", g."name", g."phone", g."idNumber", g."totalStays",
        p."name" as "providerName",
        MIN(r."checkIn") as firstStay,
        MAX(r."checkIn") as lastStay,
        COUNT(r."id") as stayCount
      FROM "Guest" g
      JOIN "Provider" p ON g."providerId" = p."id"
      LEFT JOIN "Reservation" r ON g."id" = r."guestId"
      WHERE g."totalStays" >= 2
      GROUP BY g."id"
      ORDER BY stayCount DESC
      LIMIT 50`
    );

    return NextResponse.json({
      linkedGuests,
      linkingData,
      frequentPatterns,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch investigation data";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
