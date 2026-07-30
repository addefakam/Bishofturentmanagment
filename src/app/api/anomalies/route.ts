import { NextRequest, NextResponse } from "next/server";
import { db, ensureAnomalyToggleColumn, getDbReady } from "@/lib/db";
import { getAuthContext, requirePolice, AuthError } from "@/lib/tenant";
import { requirePoliceMinRank } from "@/lib/police-permissions";
import { logAudit } from "@/lib/audit";
import { runSystemWideScan, getAnomalyStats, isAnomalyDetectionEnabled, invalidateAnomalyToggleCache } from "@/lib/anomaly-engine";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") || "";
    const severity = searchParams.get("severity") || "";
    const reviewed = searchParams.get("reviewed");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(searchParams.get("pageSize") || "50", 10)));

    // Build WHERE clauses for raw SQL
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (type) { conditions.push(`"type" = ?`); params.push(type); }
    if (severity) { conditions.push(`"severity" = ?`); params.push(severity); }
    if (reviewed !== null) { conditions.push(`"isReviewed" = ?`); params.push(reviewed === "true" ? 1 : 0); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * pageSize;

    // Ensure table exists
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AnomalyRecord" (
        "id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
        "riskScore" INTEGER NOT NULL DEFAULT 0, "guestName" TEXT NOT NULL DEFAULT '',
        "guestPhone" TEXT NOT NULL DEFAULT '', "guestIdNumber" TEXT NOT NULL DEFAULT '',
        "providerId" TEXT NOT NULL DEFAULT '', "providerName" TEXT NOT NULL DEFAULT '',
        "description" TEXT NOT NULL DEFAULT '', "metadata" TEXT NOT NULL DEFAULT '{}',
        "isReviewed" BOOLEAN NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fetch paginated anomalies + total count + stats + enabled status in parallel
    const [anomalies, countResult, stats, enabled] = await Promise.all([
      db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM "AnomalyRecord" ${where} ORDER BY "riskScore" DESC, "createdAt" DESC LIMIT ? OFFSET ?`,
        ...params, pageSize, offset
      ),
      db.$queryRawUnsafe<{ c: number }[]>(
        `SELECT COUNT(*) as c FROM "AnomalyRecord" ${where}`, ...params
      ),
      getAnomalyStats(),
      isAnomalyDetectionEnabled(),
    ]);

    return NextResponse.json({
      anomalies,
      total: Number(countResult[0]?.c || 0),
      page,
      pageSize,
      stats,
      enabled,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch anomalies";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/anomalies
 * Actions:
 *  - { action: "scan" }           — run system-wide scan (DETECTIVE+ only)
 *  - { action: "review", ids }     — mark anomalies as reviewed
 *  - { action: "toggle", enabled } — turn anomaly detection ON/OFF (ADMIN only)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const body = await req.json();
    const { action } = body;

    if (action === "toggle") {
      // Only ADMIN can toggle anomaly detection
      requirePoliceMinRank(auth, "ADMIN");

      const enabled: boolean = body.enabled ?? false;

      // Ensure column exists on existing DBs
      const client = await getDbReady();
      await ensureAnomalyToggleColumn(client);

      // Update the singleton config
      let config = await db.policeAlertConfig.findFirst();
      if (!config) {
        config = await db.policeAlertConfig.create({ data: { anomalyDetectionEnabled: enabled } });
      } else {
        config = await db.policeAlertConfig.update({
          where: { id: config.id },
          data: { anomalyDetectionEnabled: enabled },
        });
      }

      // Invalidate in-memory cache so next call picks up new value
      invalidateAnomalyToggleCache();

      logAudit(req, { action: "ANOMALY_TOGGLE", details: `Anomaly detection ${enabled ? "ENABLED" : "DISABLED"}` });
      return NextResponse.json({ enabled, message: `Anomaly detection ${enabled ? "enabled" : "disabled"}` });
    }

    if (action === "review") {
      // Mark anomalies as reviewed
      const ids: string[] = body.ids || [];
      if (ids.length === 0) {
        return NextResponse.json({ error: "ids array is required" }, { status: 400 });
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AnomalyRecord" (
          "id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
          "riskScore" INTEGER NOT NULL DEFAULT 0, "guestName" TEXT NOT NULL DEFAULT '',
          "guestPhone" TEXT NOT NULL DEFAULT '', "guestIdNumber" TEXT NOT NULL DEFAULT '',
          "providerId" TEXT NOT NULL DEFAULT '', "providerName" TEXT NOT NULL DEFAULT '',
          "description" TEXT NOT NULL DEFAULT '', "metadata" TEXT NOT NULL DEFAULT '{}',
          "isReviewed" BOOLEAN NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const placeholders = ids.map(() => "?").join(",");
      await db.$executeRawUnsafe(
        `UPDATE "AnomalyRecord" SET "isReviewed" = 1 WHERE "id" IN (${placeholders})`,
        ...ids
      );

      logAudit(req, { action: "ANOMALY_REVIEW", details: `Reviewed ${ids.length} anomalies` });
      return NextResponse.json({ reviewed: ids.length });
    }

    if (action === "scan") {
      requirePoliceMinRank(auth, "DETECTIVE");
      logAudit(req, { action: "ANOMALY_SCAN", details: "System-wide anomaly scan triggered" });

      const result = await runSystemWideScan();
      return NextResponse.json({
        message: `Scan complete. ${result.scanned} guests scanned, ${result.anomalies} anomalies found.`,
        ...result,
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'scan', 'review', or 'toggle'." }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to process anomalies";
    const status = message.includes("Police") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
