import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthContext, AuthError } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }

    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q") || "";

    // 1. Cross-provider guest movement tracker
    let linkedGuests: unknown[] = [];
    if (q) {
      linkedGuests = await db.$queryRaw(
        Prisma.sql`SELECT g.*, p."name" as "providerName", p."id" as "providerId"
        FROM "Guest" g
        JOIN "Provider" p ON g."providerId" = p."id"
        WHERE g."phone" LIKE ${"%" + q + "%"} OR g."idNumber" LIKE ${"%" + q + "%"} OR g."name" LIKE ${"%" + q + "%"}
        ORDER BY g."createdAt" DESC
        LIMIT 100`
      );
    }

    // 2. Guest linking graph — same phone or ID across providers
    const linkingData = await db.$queryRaw(
      Prisma.sql`SELECT
        g."phone",
        g."idNumber",
        COUNT(DISTINCT g."providerId") as providerCount,
        STRING_AGG(DISTINCT g."id", ', ') as guestIds,
        STRING_AGG(DISTINCT g."name", ', ') as names,
        STRING_AGG(DISTINCT p."name", ', ') as providerNames
      FROM "Guest" g
      JOIN "Provider" p ON g."providerId" = p."id"
      WHERE (g."phone" != '' AND g."phone" IS NOT NULL) OR (g."idNumber" != '' AND g."idNumber" IS NOT NULL)
      GROUP BY COALESCE(g."phone", 'no-phone'), COALESCE(g."idNumber", 'no-id'), g."phone", g."idNumber"
      HAVING providerCount > 1
      ORDER BY providerCount DESC
      LIMIT 50`
    );

    // 3. Frequent stay patterns
    const frequentPatterns = await db.$queryRaw(
      Prisma.sql`SELECT
        g."id", g."name", g."phone", g."idNumber", g."totalStays",
        p."name" as "providerName",
        MIN(r."checkIn") as firstStay,
        MAX(r."checkIn") as lastStay,
        COUNT(r."id") as stayCount
      FROM "Guest" g
      JOIN "Provider" p ON g."providerId" = p."id"
      LEFT JOIN "Reservation" r ON g."id" = r."guestId"
      WHERE g."totalStays" >= 2
      GROUP BY g."id", g."name", g."phone", g."idNumber", g."totalStays", p."name"
      ORDER BY stayCount DESC
      LIMIT 50`
    );

    return NextResponse.json({
      linkedGuests,
      linkingData,
      frequentPatterns,
    });
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to fetch investigation data";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
