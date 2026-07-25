import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = req.nextUrl;
    const format = searchParams.get("format") || "json";
    const entity = searchParams.get("entity") || "all";

    let data: Record<string, unknown> = {};

    if (entity === "all" || entity === "guests") {
      data.guests = await db.guest.findMany({
        include: { provider: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
    }

    if (entity === "all" || entity === "reservations") {
      data.reservations = await db.reservation.findMany({
        include: {
          guest: { select: { name: true, phone: true } },
          room: { select: { number: true } },
          provider: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (entity === "all" || entity === "suspects") {
      data.suspectMatches = await db.$queryRawUnsafe(
        `SELECT sm.*, sp."name" as "suspectName", sp."severity" as "suspectSeverity"
        FROM "SuspectMatch" sm
        LEFT JOIN "SuspectedPerson" sp ON sm."suspectedPersonId" = sp."id"
        ORDER BY sm."createdAt" DESC`
      );
    }

    if (entity === "all" || entity === "providers") {
      data.providers = await db.provider.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    const metadata = {
      exportedAt: new Date().toISOString(),
      exportedBy: auth.role,
      format,
      entity,
      recordCounts: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
      ),
    };

    if (format === "csv") {
      const firstKey = Object.keys(data)[0];
      if (!firstKey) return NextResponse.json({ error: "No data to export" }, { status: 404 });

      const records = data[firstKey] as Array<Record<string, unknown>>;
      if (records.length === 0) return NextResponse.json({ error: "No records to export" }, { status: 404 });

      const headers = Object.keys(records[0]);
      const csvRows = [
        headers.join(","),
        ...records.map((r) =>
          headers.map((h) => {
            const val = String(r[h] ?? "");
            return val.includes(",") ? `"${val.replace(/"/g, '""')}"` : val;
          }).join(",")
        ),
      ];

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="police-export-${firstKey}-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ ...data, _metadata: metadata });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export data";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
