import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

// Hard cap to prevent runaway exports.
const MAX_ROWS = 10000;

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";
    const format = searchParams.get("format") || "json";

    const metadata = {
      exportedAt: new Date().toISOString(),
      exportedBy: auth.role || "POLICE",
      dataSource: "GHMS Police Module",
      maxRows: MAX_ROWS,
    };

    // JSON path — keep existing response shape but cap all queries at MAX_ROWS.
    if (format !== "csv") {
      const data: Record<string, unknown> = {};

      if (type === "guests" || type === "all") {
        const guests = await db.guest.findMany({
          include: { provider: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: MAX_ROWS,
        });
        data.guests = guests.map((g) => ({
          name: g.name, phone: g.phone, idNumber: g.idNumber, idType: g.idType,
          nationality: g.nationality, provider: g.provider?.name,
          registeredAt: g.createdAt, totalSpent: g.totalSpent, totalStays: g.totalStays,
        }));
      }

      if (type === "matches" || type === "all") {
        const matches = await db.suspectMatch.findMany({
          include: { suspectedPerson: { select: { name: true, severity: true } } },
          orderBy: { createdAt: "desc" },
          take: MAX_ROWS,
        });
        data.matches = matches.map((m) => ({
          suspectName: m.suspectedPerson.name, severity: m.suspectedPerson.severity,
          guestName: m.guestName, guestPhone: m.guestPhone, providerName: m.providerName,
          matchType: m.matchType, detectedAt: m.createdAt,
        }));
      }

      if (type === "audit" || type === "all") {
        data.auditLogs = await db.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: MAX_ROWS,
        });
      }

      (data as Record<string, unknown>).metadata = metadata;
      (data as Record<string, unknown>).recordCounts = {
        guests: Array.isArray(data.guests) ? data.guests.length : 0,
        matches: Array.isArray(data.matches) ? data.matches.length : 0,
        auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs.length : 0,
      };

      logAudit(req, { action: "EXPORT_DATA", details: `type=${type} format=json` });
      return NextResponse.json(data);
    }

    // CSV path — stream to avoid buffering entire result in memory.
    logAudit(req, { action: "EXPORT_DATA", details: `type=${type} format=csv` });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (s: string) => controller.enqueue(encoder.encode(s));
        try {
          const targetType = type === "all" ? "guests" : type;
          const headers: Record<string, string[]> = {
            guests: ["name", "phone", "idNumber", "idType", "nationality", "provider", "registeredAt", "totalSpent", "totalStays"],
            matches: ["suspectName", "severity", "guestName", "guestPhone", "providerName", "matchType", "detectedAt"],
            audit: ["officerName", "action", "targetId", "targetType", "ipAddress", "createdAt"],
          };
          const headerRow = headers[targetType] || headers.guests;
          // Metadata header
          enqueue(`Export Date,${metadata.exportedAt}\n`);
          enqueue(`Exported By,${metadata.exportedBy}\n`);
          enqueue(`Max Rows,${MAX_ROWS}\n`);
          enqueue("\n");
          enqueue(headerRow.map((h) => `"${h}"`).join(",") + "\n");

          const csvEscape = (val: unknown): string => {
            if (val === null || val === undefined) return "";
            const s = val instanceof Date ? val.toISOString() : String(val);
            return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          };

          if (targetType === "guests") {
            const rows = await db.guest.findMany({
              include: { provider: { select: { name: true } } },
              orderBy: { createdAt: "desc" },
              take: MAX_ROWS,
            });
            for (const r of rows) {
              enqueue([
                csvEscape(r.name), csvEscape(r.phone), csvEscape(r.idNumber),
                csvEscape(r.idType), csvEscape(r.nationality),
                csvEscape(r.provider?.name || ""), csvEscape(r.createdAt),
                csvEscape(r.totalSpent), csvEscape(r.totalStays),
              ].join(",") + "\n");
            }
          } else if (targetType === "matches") {
            const rows = await db.suspectMatch.findMany({
              include: { suspectedPerson: { select: { name: true, severity: true } } },
              orderBy: { createdAt: "desc" },
              take: MAX_ROWS,
            });
            for (const m of rows) {
              enqueue([
                csvEscape(m.suspectedPerson.name), csvEscape(m.suspectedPerson.severity),
                csvEscape(m.guestName), csvEscape(m.guestPhone),
                csvEscape(m.providerName), csvEscape(m.matchType),
                csvEscape(m.createdAt),
              ].join(",") + "\n");
            }
          } else if (targetType === "audit") {
            const rows = await db.auditLog.findMany({
              orderBy: { createdAt: "desc" },
              take: MAX_ROWS,
            });
            for (const a of rows) {
              enqueue([
                csvEscape(a.officerName), csvEscape(a.action),
                csvEscape(a.targetId), csvEscape(a.targetType),
                csvEscape(a.ipAddress), csvEscape(a.createdAt),
              ].join(",") + "\n");
            }
          }
        } catch (err) {
          controller.error(err);
          return;
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="police-export-${type}-${Date.now()}.csv"`,
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export data";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
