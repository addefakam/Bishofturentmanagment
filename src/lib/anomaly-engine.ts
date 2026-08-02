/**
 * Smart Anomaly Detection Engine (Rule-Based, Zero External API Cost)
 *
 * Detects suspicious patterns across the GHMS system using pure SQL
 * queries and statistical rules. Runs as fire-and-forget after key events
 * (reservation creation, guest check-in, guest creation).
 *
 * Anomaly Types:
 *  - IDENTITY_MISMATCH: Same phone with different names/IDs across providers
 *  - RAPID_MULTI_PROVIDER: Bookings at 2+ providers within 48 hours
 *  - NO_SHOW_PATTERN: Guest with 3+ cancellations or no-shows
 *  - CASH_ANOMALY: Large cash payments (above threshold)
 *  - CROSS_PROVIDER_ID: Same person using different ID numbers
 *  - SHORT_STAY_PATTERN: Repeated very short stays (1 night) across providers
 *  - FAKE_ID_PATTERN: Multiple guests sharing the same ID number
 */

import { db } from "./db";
import { sql } from "@prisma/client/runtime/library";

// ── Anomaly Detection Toggle (in-memory cache) ──
let _cachedEnabled: boolean | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Check if anomaly detection is enabled.
 * Uses in-memory cache (60s TTL) to avoid DB query on every call.
 * Falls back to FALSE if config is missing or DB error occurs.
 */
export async function isAnomalyDetectionEnabled(): Promise<boolean> {
  const now = Date.now();
  if (_cachedEnabled !== null && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _cachedEnabled;
  }
  try {
    const config = await db.policeAlertConfig.findFirst({
      select: { anomalyDetectionEnabled: true },
    });
    _cachedEnabled = config?.anomalyDetectionEnabled ?? false;
    _cacheTimestamp = now;
    return _cachedEnabled;
  } catch (e) {
    console.warn("[anomaly] Failed to read toggle state, defaulting to OFF:", e);
    _cachedEnabled = false;
    _cacheTimestamp = now;
    return false;
  }
}

/**
 * Force-invalidate the in-memory cache (called after toggle change).
 */
export function invalidateAnomalyToggleCache(): void {
  _cachedEnabled = null;
  _cacheTimestamp = 0;
}

// ── Types ──

export type AnomalyType =
  | "IDENTITY_MISMATCH"
  | "RAPID_MULTI_PROVIDER"
  | "NO_SHOW_PATTERN"
  | "CASH_ANOMALY"
  | "CROSS_PROVIDER_ID"
  | "SHORT_STAY_PATTERN"
  | "FAKE_ID_PATTERN";

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AnomalyRecord {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  riskScore: number;
  guestName: string;
  guestPhone: string;
  guestIdNumber: string;
  providerId: string;
  providerName: string;
  description: string;
  metadata: string;
  isReviewed: boolean;
  createdAt: string;
}

interface DetectContext {
  guestId?: string;
  guestName?: string;
  guestPhone?: string;
  guestIdNumber?: string;
  providerId: string;
  providerName?: string;
  reservationId?: string;
  trigger: "RESERVATION" | "CHECKIN" | "GUEST_CREATE" | "MANUAL";
}

// ── Risk Score Weights ──
const RISK_WEIGHTS: Record<AnomalyType, number> = {
  IDENTITY_MISMATCH: 30,
  RAPID_MULTI_PROVIDER: 35,
  NO_SHOW_PATTERN: 15,
  CASH_ANOMALY: 25,
  CROSS_PROVIDER_ID: 40,
  SHORT_STAY_PATTERN: 25,
  FAKE_ID_PATTERN: 45,
};

// ── Helpers ──

function generateId(): string {
  return `anom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function severityFromScore(score: number): AnomalySeverity {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

async function getProviderName(providerId: string): Promise<string> {
  if (!providerId) return "";
  const p = await db.provider.findUnique({ where: { id: providerId }, select: { name: true } });
  return p?.name || "";
}

// ── Duplicate Check (prevent flood of identical anomalies) ──
async function isDuplicate(type: AnomalyType, guestPhone: string, providerId: string, withinHours: number = 24): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinHours * 3600_000).toISOString();
  const count = await db.$queryRaw<{ c: bigint }[]>(
    sql`SELECT COUNT(*)::bigint as c FROM "AnomalyRecord"
     WHERE "type" = ${type} AND "guestPhone" = ${guestPhone || ""} AND "providerId" = ${providerId || ""} AND "createdAt" >= ${cutoff}::timestamptz`
  );
  return (count[0]?.c || 0n) > 0n;
}

// ── Individual Detectors ──

async function detectIdentityMismatch(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("IDENTITY_MISMATCH", phone, ctx.providerId, 48)) return null;

  const rows = await db.$queryRaw<{
    name: string; idNumber: string; providerId: string; providerName: string;
  }[]>(
    sql`SELECT g."name", g."idNumber", g."providerId", p."name" as "providerName"
     FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
     WHERE LOWER(TRIM(g."phone")) = LOWER(${phone})
     AND g."providerId" != ${ctx.providerId}
     LIMIT 20`
  );

  if (rows.length === 0) return null;

  const uniqueNames = new Set(rows.map(r => r.name.toLowerCase()));
  const uniqueIds = new Set(rows.map(r => r.idNumber.trim()).filter(id => id.length > 0));
  const providers = [...new Set(rows.map(r => r.providerName))];

  if (uniqueNames.size < 2 && uniqueIds.size < 2) return null;

  const baseScore = RISK_WEIGHTS.IDENTITY_MISMATCH;
  const bonus = uniqueNames.size > 2 ? 20 : uniqueIds.size > 2 ? 15 : 0;
  const score = Math.min(100, baseScore + bonus + (uniqueIds.size - 1) * 10);

  return {
    id: generateId(),
    type: "IDENTITY_MISMATCH",
    severity: severityFromScore(score),
    riskScore: score,
    guestName: ctx.guestName || "",
    guestPhone: phone,
    guestIdNumber: ctx.guestIdNumber || "",
    providerId: ctx.providerId,
    providerName: ctx.providerName || "",
    description: `Phone ${phone} linked to ${uniqueNames.size} different name(s) and ${uniqueIds.size} different ID(s) across ${providers.length} provider(s): ${providers.join(", ")}`,
    metadata: JSON.stringify({ names: [...uniqueNames], idCount: uniqueIds.size, providers }),
    isReviewed: false,
    createdAt: new Date().toISOString(),
  };
}

async function detectRapidMultiProvider(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("RAPID_MULTI_PROVIDER", phone, ctx.providerId, 48)) return null;

  const cutoff48h = new Date(Date.now() - 48 * 3600_000).toISOString().split("T")[0];

  const rows = await db.$queryRaw<{
    providerId: string; providerName: string; checkIn: string; status: string;
  }[]>(
    sql`SELECT r."providerId", p."name" as "providerName", r."checkIn", r."status"
     FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
     JOIN "Provider" p ON p."id" = r."providerId"
     WHERE LOWER(TRIM(g."phone")) = LOWER(${phone})
     AND r."checkIn" >= ${cutoff48h} AND r."status" != 'CANCELLED'
     ORDER BY r."checkIn" DESC`
  );

  const uniqueProviders = new Set(rows.map(r => r.providerId));
  if (uniqueProviders.size < 2) return null;

  const providerNames = [...new Set(rows.map(r => r.providerName))];
  const score = Math.min(100, RISK_WEIGHTS.RAPID_MULTI_PROVIDER + (uniqueProviders.size - 2) * 15);

  return {
    id: generateId(),
    type: "RAPID_MULTI_PROVIDER",
    severity: severityFromScore(score),
    riskScore: score,
    guestName: ctx.guestName || "",
    guestPhone: phone,
    guestIdNumber: ctx.guestIdNumber || "",
    providerId: ctx.providerId,
    providerName: ctx.providerName || "",
    description: `Booked at ${uniqueProviders.size} providers within 48h: ${providerNames.join(", ")}`,
    metadata: JSON.stringify({ providers: providerNames, bookingCount: rows.length }),
    isReviewed: false,
    createdAt: new Date().toISOString(),
  };
}

async function detectNoShowPattern(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("NO_SHOW_PATTERN", phone, ctx.providerId, 168)) return null;

  const today = new Date().toISOString().split("T")[0];

  const rows = await db.$queryRaw<{ count: bigint }[]>(
    sql`SELECT COUNT(*)::bigint as count
     FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
     WHERE LOWER(TRIM(g."phone")) = LOWER(${phone})
     AND r."status" IN ('CANCELLED', 'UPCOMING')
     AND r."checkIn" < ${today}::date`
  );

  const noShowCount = Number(rows[0]?.count || 0);
  if (noShowCount < 3) return null;

  const score = Math.min(100, RISK_WEIGHTS.NO_SHOW_PATTERN + (noShowCount - 3) * 10);

  return {
    id: generateId(),
    type: "NO_SHOW_PATTERN",
    severity: severityFromScore(score),
    riskScore: score,
    guestName: ctx.guestName || "",
    guestPhone: phone,
    guestIdNumber: ctx.guestIdNumber || "",
    providerId: ctx.providerId,
    providerName: ctx.providerName || "",
    description: `${noShowCount} cancelled or unfulfilled reservations found for this guest across the system`,
    metadata: JSON.stringify({ noShowCount }),
    isReviewed: false,
    createdAt: new Date().toISOString(),
  };
}

async function detectCashAnomaly(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (ctx.trigger !== "RESERVATION" && ctx.trigger !== "CHECKIN") return null;
  if (!ctx.reservationId) return null;

  const payments = await db.payment.findMany({
    where: { reservationId: ctx.reservationId, method: "CASH" },
  });
  if (payments.length === 0) return null;

  const totalCash = payments.reduce((sum, p) => sum + p.amount, 0);

  const avgRows = await db.$queryRaw<{ avg: number | null }[]>(
    sql`SELECT AVG("amount") as avg FROM "Payment" WHERE "providerId" = ${ctx.providerId} AND "method" = 'CASH'`
  );
  const avgCash = Number(avgRows[0]?.avg || 0);

  const HIGH_CASH_THRESHOLD = 5000;
  const isHigh = totalCash >= HIGH_CASH_THRESHOLD;
  const isUnusual = avgCash > 0 && totalCash >= avgCash * 3;

  if (!isHigh && !isUnusual) return null;

  if (await isDuplicate("CASH_ANOMALY", ctx.guestPhone || "", ctx.providerId, 24)) return null;

  const score = Math.min(100, RISK_WEIGHTS.CASH_ANOMALY + (isHigh && isUnusual ? 20 : 10));

  return {
    id: generateId(),
    type: "CASH_ANOMALY",
    severity: severityFromScore(score),
    riskScore: score,
    guestName: ctx.guestName || "",
    guestPhone: ctx.guestPhone || "",
    guestIdNumber: ctx.guestIdNumber || "",
    providerId: ctx.providerId,
    providerName: ctx.providerName || "",
    description: `Cash payment of ${totalCash.toLocaleString()} ETB (provider avg: ${Math.round(avgCash)} ETB)`,
    metadata: JSON.stringify({ amount: totalCash, avgCash: Math.round(avgCash), threshold: HIGH_CASH_THRESHOLD }),
    isReviewed: false,
    createdAt: new Date().toISOString(),
  };
}

async function detectCrossProviderId(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestIdNumber || ctx.guestIdNumber.length < 2) return null;
  const idNum = ctx.guestIdNumber.trim();

  if (await isDuplicate("CROSS_PROVIDER_ID", ctx.guestPhone || "", ctx.providerId, 168)) return null;

  const rows = await db.$queryRaw<{
    name: string; phone: string; providerId: string; providerName: string;
  }[]>(
    sql`SELECT g."name", g."phone", g."providerId", p."name" as "providerName"
     FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
     WHERE LOWER(TRIM(g."idNumber")) = LOWER(${idNum})
     AND g."providerId" != ${ctx.providerId}`
  );

  if (rows.length === 0) return null;

  const uniqueNames = new Set(rows.map(r => r.name.toLowerCase()));
  const uniquePhones = new Set(rows.map(r => r.phone.trim()).filter(p => p.length > 0));
  const providers = [...new Set(rows.map(r => r.providerName))];

  if (uniqueNames.size < 2) return null;

  const score = Math.min(100, RISK_WEIGHTS.CROSS_PROVIDER_ID + (uniqueNames.size - 2) * 15);

  return {
    id: generateId(),
    type: "CROSS_PROVIDER_ID",
    severity: severityFromScore(score),
    riskScore: score,
    guestName: ctx.guestName || "",
    guestPhone: ctx.guestPhone || "",
    guestIdNumber: idNum,
    providerId: ctx.providerId,
    providerName: ctx.providerName || "",
    description: `ID number "${idNum}" used with ${uniqueNames.size} different names at ${providers.length} providers: ${providers.join(", ")}`,
    metadata: JSON.stringify({ names: [...uniqueNames], phoneCount: uniquePhones.size, providers }),
    isReviewed: false,
    createdAt: new Date().toISOString(),
  };
}

async function detectShortStayPattern(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("SHORT_STAY_PATTERN", phone, ctx.providerId, 168)) return null;

  const cutoff30d = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];

  const rows = await db.$queryRaw<{
    providerId: string; providerName: string; checkIn: string; nights: number;
  }[]>(
    sql`SELECT r."providerId", p."name" as "providerName", r."checkIn", r."nights"
     FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
     JOIN "Provider" p ON p."id" = r."providerId"
     WHERE LOWER(TRIM(g."phone")) = LOWER(${phone})
     AND r."checkIn" >= ${cutoff30d} AND r."nights" <= 1 AND r."status" != 'CANCELLED'
     ORDER BY r."checkIn" DESC`
  );

  const shortStays = rows.filter(r => r.nights <= 1);
  const uniqueProviders = new Set(shortStays.map(r => r.providerId));
  if (shortStays.length < 3 || uniqueProviders.size < 2) return null;

  const providerNames = [...new Set(shortStays.map(r => r.providerName))];
  const score = Math.min(100, RISK_WEIGHTS.SHORT_STAY_PATTERN + (shortStays.length - 3) * 8 + (uniqueProviders.size - 2) * 10);

  return {
    id: generateId(),
    type: "SHORT_STAY_PATTERN",
    severity: severityFromScore(score),
    riskScore: score,
    guestName: ctx.guestName || "",
    guestPhone: phone,
    guestIdNumber: ctx.guestIdNumber || "",
    providerId: ctx.providerId,
    providerName: ctx.providerName || "",
    description: `${shortStays.length} one-night stays at ${uniqueProviders.size} providers in 30 days: ${providerNames.join(", ")}`,
    metadata: JSON.stringify({ stayCount: shortStays.length, providerCount: uniqueProviders.size, providers: providerNames }),
    isReviewed: false,
    createdAt: new Date().toISOString(),
  };
}

async function detectFakeIdPattern(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestIdNumber || ctx.guestIdNumber.length < 2) return null;
  const idNum = ctx.guestIdNumber.trim();

  if (await isDuplicate("FAKE_ID_PATTERN", ctx.guestPhone || "", ctx.providerId, 168)) return null;

  const rows = await db.$queryRaw<{
    name: string; phone: string; providerId: string; providerName: string;
  }[]>(
    sql`SELECT g."name", g."phone", g."providerId", p."name" as "providerName"
     FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
     WHERE LOWER(TRIM(g."idNumber")) = LOWER(${idNum})
     AND g."id" != COALESCE((
       SELECT g2."id" FROM "Guest" g2
       WHERE LOWER(TRIM(g2."idNumber")) = LOWER(${idNum}) AND g2."providerId" = ${ctx.providerId}
       LIMIT 1
     ), '')`
  );

  if (rows.length === 0) return null;

  const uniqueNames = new Set(rows.map(r => r.name.toLowerCase()));
  const providers = [...new Set(rows.map(r => r.providerName))];

  const score = Math.min(100, RISK_WEIGHTS.FAKE_ID_PATTERN + rows.length * 5);

  return {
    id: generateId(),
    type: "FAKE_ID_PATTERN",
    severity: severityFromScore(score),
    riskScore: score,
    guestName: ctx.guestName || "",
    guestPhone: ctx.guestPhone || "",
    guestIdNumber: idNum,
    providerId: ctx.providerId,
    providerName: ctx.providerName || "",
    description: `ID "${idNum}" shared by ${rows.length + 1} guests (${uniqueNames.size} unique names) across ${providers.length} provider(s)`,
    metadata: JSON.stringify({ guestCount: rows.length + 1, names: [...uniqueNames], providers }),
    isReviewed: false,
    createdAt: new Date().toISOString(),
  };
}

// ── Save anomaly to DB ──
async function saveAnomaly(anomaly: AnomalyRecord): Promise<void> {
  await db.$executeRaw(
    sql`INSERT INTO "AnomalyRecord" ("id", "type", "severity", "riskScore", "guestName", "guestPhone", "guestIdNumber", "providerId", "providerName", "description", "metadata", "isReviewed", "createdAt")
     VALUES (${anomaly.id}, ${anomaly.type}, ${anomaly.severity}, ${anomaly.riskScore}, ${anomaly.guestName}, ${anomaly.guestPhone}, ${anomaly.guestIdNumber}, ${anomaly.providerId}, ${anomaly.providerName}, ${anomaly.description}, ${anomaly.metadata}, false, ${anomaly.createdAt}::timestamptz)`
  );
}

// ── Main Detection Orchestrator ──

export async function runAnomalyDetection(ctx: DetectContext): Promise<void> {
  try {
    if (ctx.trigger !== "MANUAL") {
      const enabled = await isAnomalyDetectionEnabled();
      if (!enabled) return;
    }

    if (!ctx.providerName && ctx.providerId) {
      ctx.providerName = await getProviderName(ctx.providerId);
    }

    const results = await Promise.all([
      detectIdentityMismatch(ctx),
      detectRapidMultiProvider(ctx),
      detectNoShowPattern(ctx),
      detectCashAnomaly(ctx),
      detectCrossProviderId(ctx),
      detectShortStayPattern(ctx),
      detectFakeIdPattern(ctx),
    ]);

    const anomalies = results.filter((r): r is AnomalyRecord => r !== null);
    if (anomalies.length === 0) return;

    for (const anomaly of anomalies) {
      try {
        await saveAnomaly(anomaly);
      } catch (e) {
        console.error("[anomaly] Failed to save:", e);
      }
    }

    console.log(`[anomaly] ${anomalies.length} anomaly(ies) detected for ${ctx.guestPhone || ctx.guestName || "unknown"} [${ctx.trigger}]`);

    const critical = anomalies.filter(a => a.severity === "HIGH" || a.severity === "CRITICAL");
    for (const a of critical) {
      try {
        await db.notification.create({
          data: {
            title: `${a.severity}: ${a.type.replace(/_/g, " ")}`,
            message: a.description,
            type: a.severity === "CRITICAL" ? "ERROR" : "WARNING",
            providerId: a.providerId || undefined,
          },
        });
      } catch {
        // Non-critical
      }
    }
  } catch (error) {
    console.error("[anomaly] Detection run failed:", error);
  }
}

export async function runSystemWideScan(): Promise<{ scanned: number; anomalies: number }> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000);

  const guests = await db.$queryRaw<{
    id: string; name: string; phone: string; idNumber: string; providerId: string;
  }[]>(
    sql`SELECT g."id", g."name", g."phone", g."idNumber", g."providerId"
     FROM "Guest" g
     WHERE g."createdAt" >= ${ninetyDaysAgo}::timestamptz
       AND (g."phone" IS NOT NULL AND g."phone" != '')
     ORDER BY g."createdAt" DESC
     LIMIT 2000`
  );

  const BATCH = 20;
  for (let i = 0; i < guests.length; i += BATCH) {
    const batch = guests.slice(i, i + BATCH);
    await Promise.all(
      batch.map(g =>
        runAnomalyDetection({
          guestId: g.id,
          guestName: g.name,
          guestPhone: g.phone,
          guestIdNumber: g.idNumber,
          providerId: g.providerId,
          trigger: "MANUAL",
        }).then(() => {})
      )
    );
  }

  const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
  const recentAnomalies = await db.$queryRaw<{ c: bigint }[]>(
    sql`SELECT COUNT(*)::bigint as c FROM "AnomalyRecord" WHERE "createdAt" >= ${fiveMinAgo}::timestamptz`
  );

  return { scanned: guests.length, anomalies: Number(recentAnomalies[0]?.c || 0) };
}

export async function getAnomalyStats(providerId?: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const baseWhere = providerId
    ? sql`WHERE "providerId" = ${providerId}`
    : sql``;

  const [total, unreviewed, bySeverity, byType, recent] = await Promise.all([
    db.$queryRaw<{ c: bigint }[]>(
      sql`SELECT COUNT(*)::bigint as c FROM "AnomalyRecord" ${baseWhere}`
    ),
    db.$queryRaw<{ c: bigint }[]>(
      providerId
        ? sql`SELECT COUNT(*)::bigint as c FROM "AnomalyRecord" WHERE "providerId" = ${providerId} AND "isReviewed" = false`
        : sql`SELECT COUNT(*)::bigint as c FROM "AnomalyRecord" WHERE "isReviewed" = false`
    ),
    db.$queryRaw<{ severity: string; count: bigint }[]>(
      sql`SELECT "severity", COUNT(*)::bigint as count FROM "AnomalyRecord" ${baseWhere} GROUP BY "severity"`
    ),
    db.$queryRaw<{ type: string; count: bigint }[]>(
      sql`SELECT "type", COUNT(*)::bigint as count FROM "AnomalyRecord" ${baseWhere} GROUP BY "type" ORDER BY count DESC`
    ),
    db.$queryRaw<{ c: bigint }[]>(
      sql`SELECT COUNT(*)::bigint as c FROM "AnomalyRecord" WHERE "createdAt" >= ${thirtyDaysAgo}::timestamptz`
    ),
  ]);

  return {
    total: Number(total[0]?.c || 0),
    unreviewed: Number(unreviewed[0]?.c || 0),
    bySeverity: bySeverity.map(r => ({ severity: r.severity, count: Number(r.count) })),
    byType: byType.map(r => ({ type: r.type, count: Number(r.count) })),
    last30Days: Number(recent[0]?.c || 0),
  };
}
