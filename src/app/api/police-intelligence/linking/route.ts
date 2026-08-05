import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthContext, AuthError } from "@/lib/tenant";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 5;

interface LinkKeyRow {
  linkType: string;
  linkValue: string;
  total: bigint;
}

interface GuestRow {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  nationality: string;
  providerName: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") { return NextResponse.json({ error: "Access denied" }, { status: 403 }); }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)))
    );
    const offset = (page - 1) * pageSize;

    // Step 1: Find all duplicate phone/idNumber keys (capped, paginated).
    // Uses SQL GROUP BY + HAVING so we don't load all guests into memory.
    // UNION ALL combines phone and idNumber duplicates into one paginated stream.
    const linkKeys = await db.$queryRaw<LinkKeyRow[]>(
      Prisma.sql`SELECT linkType, linkValue, COUNT(*) as total FROM (
         SELECT 'phone' AS linkType, LOWER(TRIM("phone")) AS linkValue
         FROM "Guest"
         WHERE "phone" IS NOT NULL AND "phone" != ''
         UNION ALL
         SELECT 'idNumber' AS linkType, LOWER(TRIM("idNumber")) AS linkValue
         FROM "Guest"
         WHERE "idNumber" IS NOT NULL AND "idNumber" != ''
       ) AS combined
       WHERE linkValue != ''
       GROUP BY linkType, linkValue
       HAVING COUNT(*) > 1
       ORDER BY total DESC
       LIMIT ${pageSize} OFFSET ${offset}`
    );

    // Step 2: Get total count of distinct link keys (for pagination metadata).
    const totalRow = await db.$queryRaw<{count: bigint}[]>(
      Prisma.sql`SELECT COUNT(*) as count FROM (
         SELECT linkType, linkValue
         FROM (
           SELECT 'phone' AS linkType, LOWER(TRIM("phone")) AS linkValue
           FROM "Guest"
           WHERE "phone" IS NOT NULL AND "phone" != ''
           UNION ALL
           SELECT 'idNumber' AS linkType, LOWER(TRIM("idNumber")) AS linkValue
           FROM "Guest"
           WHERE "idNumber" IS NOT NULL AND "idNumber" != ''
         ) AS combined
         WHERE linkValue != ''
         GROUP BY linkType, linkValue
         HAVING COUNT(*) > 1
       ) AS dup_keys`
    );
    const total = Number(totalRow[0]?.count || 0);

    // Step 3: For each link key on the current page, fetch the matching guests.
    // This is bounded by pageSize * (max group size). With small page sizes,
    // memory usage is predictable.
    const linkedGroups: {
      linkType: string;
      linkValue: string;
      guests: {
        id: string;
        name: string;
        phone: string;
        idNumber: string;
        providerName: string;
        nationality: string;
      }[];
    }[] = [];

    for (const key of linkKeys) {
      const field = key.linkType === "phone" ? "phone" : "idNumber";
      const col = field === "phone" ? Prisma.sql`"phone"` : Prisma.sql`"idNumber"`;
      const guests: GuestRow[] = await db.$queryRaw<GuestRow[]>(
        Prisma.sql`SELECT g."id", g."name", g."phone", g."idNumber", g."nationality",
                p."name" AS "providerName"
         FROM "Guest" g
         LEFT JOIN "Provider" p ON g."providerId" = p."id"
         WHERE LOWER(TRIM(g.${col})) = ${key.linkValue}
         ORDER BY g."createdAt" DESC`
      );
      linkedGroups.push({
        linkType: key.linkType === "phone" ? "Same Phone" : "Same ID Number",
        linkValue: key.linkValue,
        guests: guests.map((g) => ({
          id: g.id,
          name: g.name,
          phone: g.phone,
          idNumber: g.idNumber,
          providerName: g.providerName || "Unknown",
          nationality: g.nationality,
        })),
      });
    }

    return NextResponse.json({
      linkedGroups,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: unknown) {
        if (error instanceof AuthError) {
          return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
    const message = error instanceof Error ? error.message : "Failed to fetch guest links";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
