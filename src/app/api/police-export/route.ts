import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    requirePolice(auth);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "all";
    const format = searchParams.get("format") || "json";

    const metadata = {
      exportedAt: new Date().toISOString(),
      exportedBy: auth.role || "POLICE",
      dataSource: "GHMS Police Module",
    };

    let data: Record<string, unknown> = {};

    if (type === "guests" || type === "all") {
      const guests = await db.guest.findMany({
        include: { provider: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      data.guests = guests.map((g) => ({ name: g.name, phone: g.phone, idNumber: g.idNumber, idType: g.idType, nationality: g.nationality, provider: g.provider?.name, registeredAt: g.createdAt, totalSpent: g.totalSpent, totalStays: g.totalStays }));
    }

    if (type === "matches" || type === "all") {
      const matches = await db.suspectMatch.findMany({
        include: { suspectedPerson: { select: { name: true, severity: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      data.matches = matches.map((m) => ({ suspectName: m.suspectedPerson.name, severity: m.suspectedPerson.severity, guestName: m.guestName, guestPhone: m.guestPhone, providerName: m.providerName, matchType: m.matchType, detectedAt: m.createdAt }));
    }

    if (type === "audit" || type === "all") {
      const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
      data.auditLogs = logs;
    }

    (data as Record<string, unknown>).metadata = metadata;
    (data as Record<string, unknown>).recordCounts = { guests: Array.isArray(data.guests) ? data.guests.length : 0, matches: Array.isArray(data.matches) ? data.matches.length : 0, auditLogs: Array.isArray(data.auditLogs) ? data.auditLogs.length : 0 };

    if (format === "csv") {
      // Convert first array to CSV
      const arr = data.guests || data.matches || [];
      if (!Array.isArray(arr) || arr.length === 0) {
        return NextResponse.json({ error: "No data to export" }, { status: 400 });
      }
      const headers = Object.keys(arr[0] as Record<string, unknown>);
      const csv = [
        headers.join(","),
        `Export Date,${metadata.exportedAt}`,
        `Exported By,${metadata.exportedBy}`,
        "",
        headers.map((h) => `"${h}"`).join(","),
        ...(arr as Record<string, unknown>[]).map((row) => headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",")).join("\n"),
      ].join("\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="police-export-${Date.now()}.csv"` } });
    }

    logAudit(req, { action: "EXPORT_DATA", details: `Exported type=${type} format=${format}` });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to export data";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
