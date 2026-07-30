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
 *  - OCCUPANCY_SPIKE: Sudden booking spike at a provider
 *  - SHORT_STAY_PATTERN: Repeated very short stays (1 night) across providers
 *  - FAKE_ID_PATTERN: Multiple guests sharing the same ID number
 */

import { db, ensureAnomalyToggleColumn, getDbReady } from "./db";

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
    const client = await getDbReady();
    await ensureAnomalyToggleColumn(client);
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
  | "OCCUPANCY_SPIKE"
  | "SHORT_STAY_PATTERN"
  | "FAKE_ID_PATTERN";

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AnomalyRecord {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  riskScore: number;       // 0-100
  guestName: string;
  guestPhone: string;
  guestIdNumber: string;
  providerId: string;
  providerName: string;
  description: string;
  metadata: string;         // JSON
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
  OCCUPANCY_SPIKE: 20,
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

async function ensureAnomalyTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AnomalyRecord" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "type" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
        "riskScore" INTEGER NOT NULL DEFAULT 0,
        "guestName" TEXT NOT NULL DEFAULT '',
        "guestPhone" TEXT NOT NULL DEFAULT '',
        "guestIdNumber" TEXT NOT NULL DEFAULT '',
        "providerId" TEXT NOT NULL DEFAULT '',
        "providerName" TEXT NOT NULL DEFAULT '',
        "description" TEXT NOT NULL DEFAULT '',
        "metadata" TEXT NOT NULL DEFAULT '{}',
        "isReviewed" BOOLEAN NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AnomalyRecord_type_idx" ON "AnomalyRecord"("type")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AnomalyRecord_severity_idx" ON "AnomalyRecord"("severity")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AnomalyRecord_isReviewed_idx" ON "AnomalyRecord"("isReviewed")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AnomalyRecord_riskScore_idx" ON "AnomalyRecord"("riskScore")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AnomalyRecord_providerId_idx" ON "AnomalyRecord"("providerId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AnomalyRecord_guestPhone_idx" ON "AnomalyRecord"("guestPhone")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AnomalyRecord_createdAt_idx" ON "AnomalyRecord"("createdAt")`);
  } catch (e) {
    console.error("[anomaly] Failed to ensure table:", e);
  }
}

// ── Duplicate Check (prevent flood of identical anomalies) ──
async function isDuplicate(type: AnomalyType, guestPhone: string, providerId: string, withinHours: number = 24): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinHours * 3600_000).toISOString();
  const count = await db.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*) as c FROM "AnomalyRecord"
     WHERE "type" = ? AND "guestPhone" = ? AND "providerId" = ? AND "createdAt" >= ?`,
    type, guestPhone || "", providerId || "", cutoff
  );
  return (count[0]?.c || 0) > 0;
}

// ── Individual Detectors ──

/**
 * 1. IDENTITY_MISMATCH: Same phone number associated with different names
 *    or different ID numbers across different providers.
 */
async function detectIdentityMismatch(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("IDENTITY_MISMATCH", phone, ctx.providerId, 48)) return null;

  const rows = await db.$queryRawUnsafe<{
    name: string; idNumber: string; providerId: string; providerName: string;
  }[]>(
    `SELECT g."name", g."idNumber", g."providerId", p."name" as "providerName"
     FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
     WHERE LOWER(TRIM(g."phone")) = LOWER(?)
     AND g."providerId" != ?
     LIMIT 20`,
    phone, ctx.providerId
  );

  if (rows.length === 0) return null;

  const uniqueNames = new Set(rows.map(r => r.name.toLowerCase()));
  const uniqueIds = new Set(rows.map(r => r.idNumber.trim()).filter(id => id.length > 0));
  const providers = [...new Set(rows.map(r => r.providerName))];

  // Only flag if there are different names OR different IDs
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

/**
 * 2. RAPID_MULTI_PROVIDER: Guest made bookings at 2+ providers
 *    within the last 48 hours.
 */
async function detectRapidMultiProvider(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("RAPID_MULTI_PROVIDER", phone, ctx.providerId, 48)) return null;

  const cutoff48h = new Date(Date.now() - 48 * 3600_000).toISOString().split("T")[0];

  const rows = await db.$queryRawUnsafe<{
    providerId: string; providerName: string; checkIn: string; status: string;
  }[]>(
    `SELECT r."providerId", p."name" as "providerName", r."checkIn", r."status"
     FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
     JOIN "Provider" p ON p."id" = r."providerId"
     WHERE LOWER(TRIM(g."phone")) = LOWER(?)
     AND r."checkIn" >= ? AND r."status" != 'CANCELLED'
     ORDER BY r."checkIn" DESC`,
    phone, cutoff48h
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

/**
 * 3. NO_SHOW_PATTERN: Guest has 3+ cancelled or no-show reservations.
 */
async function detectNoShowPattern(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("NO_SHOW_PATTERN", phone, ctx.providerId, 168)) return null; // 7 days

  const rows = await db.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*) as count
     FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
     WHERE LOWER(TRIM(g."phone")) = LOWER(?)
     AND r."status" IN ('CANCELLED', 'UPCOMING')
     AND r."checkIn" < date('now')`,
    phone
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

/**
 * 4. CASH_ANOMALY: Large cash payments (above 5000 ETB or 3x average).
 */
async function detectCashAnomaly(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (ctx.trigger !== "RESERVATION" && ctx.trigger !== "CHECKIN") return null;
  if (!ctx.reservationId) return null;

  // Get payment for this reservation
  const payments = await db.payment.findMany({
    where: { reservationId: ctx.reservationId, method: "CASH" },
  });
  if (payments.length === 0) return null;

  const totalCash = payments.reduce((sum, p) => sum + p.amount, 0);

  // Get average payment for this provider
  const avgRows = await db.$queryRawUnsafe<{ avg: number | null }[]>(
    `SELECT AVG("amount") as avg FROM "Payment" WHERE "providerId" = ? AND "method" = 'CASH'`,
    ctx.providerId
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

/**
 * 5. CROSS_PROVIDER_ID: Same ID number used at multiple providers
 *    with different names (potential identity fraud).
 */
async function detectCrossProviderId(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestIdNumber || ctx.guestIdNumber.length < 2) return null;
  const idNum = ctx.guestIdNumber.trim();

  if (await isDuplicate("CROSS_PROVIDER_ID", ctx.guestPhone || "", ctx.providerId, 168)) return null;

  const rows = await db.$queryRawUnsafe<{
    name: string; phone: string; providerId: string; providerName: string;
  }[]>(
    `SELECT g."name", g."phone", g."providerId", p."name" as "providerName"
     FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
     WHERE LOWER(TRIM(g."idNumber")) = LOWER(?)
     AND g."providerId" != ?`,
    idNum, ctx.providerId
  );

  if (rows.length === 0) return null;

  const uniqueNames = new Set(rows.map(r => r.name.toLowerCase()));
  const uniquePhones = new Set(rows.map(r => r.phone.trim()).filter(p => p.length > 0));
  const providers = [...new Set(rows.map(r => r.providerName))];

  // Only flag if names differ (same ID, different person = fraud)
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

/**
 * 6. SHORT_STAY_PATTERN: Multiple 1-night stays across different providers
 *    within 30 days (common in illicit activity).
 */
async function detectShortStayPattern(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestPhone || ctx.guestPhone.length < 4) return null;
  const phone = ctx.guestPhone.trim();

  if (await isDuplicate("SHORT_STAY_PATTERN", phone, ctx.providerId, 168)) return null;

  const cutoff30d = new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0];

  const rows = await db.$queryRawUnsafe<{
    providerId: string; providerName: string; checkIn: string; nights: number;
  }[]>(
    `SELECT r."providerId", p."name" as "providerName", r."checkIn", r."nights"
     FROM "Reservation" r JOIN "Guest" g ON r."guestId" = g."id"
     JOIN "Provider" p ON p."id" = r."providerId"
     WHERE LOWER(TRIM(g."phone")) = LOWER(?)
     AND r."checkIn" >= ? AND r."nights" <= 1 AND r."status" != 'CANCELLED'
     ORDER BY r."checkIn" DESC`,
    phone, cutoff30d
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

/**
 * 7. FAKE_ID_PATTERN: Multiple guests registered with the same ID number
 *    (indicates shared/fake IDs).
 */
async function detectFakeIdPattern(ctx: DetectContext): Promise<AnomalyRecord | null> {
  if (!ctx.guestIdNumber || ctx.guestIdNumber.length < 2) return null;
  const idNum = ctx.guestIdNumber.trim();

  if (await isDuplicate("FAKE_ID_PATTERN", ctx.guestPhone || "", ctx.providerId, 168)) return null;

  const rows = await db.$queryRawUnsafe<{
    name: string; phone: string; providerId: string; providerName: string;
  }[]>(
    `SELECT g."name", g."phone", g."providerId", p."name" as "providerName"
     FROM "Guest" g JOIN "Provider" p ON p."id" = g."providerId"
     WHERE LOWER(TRIM(g."idNumber")) = LOWER(?)
     AND g."id" != COALESCE((
       SELECT g2."id" FROM "Guest" g2
       WHERE LOWER(TRIM(g2."idNumber")) = LOWER(?) AND g2."providerId" = ?
       LIMIT 1
     ), '')`,
    idNum, idNum, ctx.providerId
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

// ── Main Detection Orchestrator ──

/**
 * Run all anomaly detectors for a given context.
 * Fire-and-forget: never throws, never blocks the caller.
 */
export async function runAnomalyDetection(ctx: DetectContext): Promise<void> {
  try {
    // ── TOGGLE CHECK: skip entirely when disabled (zero overhead) ──
    // Manual scans (trigger: "MANUAL") bypass the toggle — they are explicit user action.
    if (ctx.trigger !== "MANUAL") {
      const enabled = await isAnomalyDetectionEnabled();
      if (!enabled) return;
    }

    await ensureAnomalyTable();

    // Resolve provider name if missing
    if (!ctx.providerName && ctx.providerId) {
      ctx.providerName = await getProviderName(ctx.providerId);
    }

    // Run all detectors in parallel
    const results = await Promise.all([
      detectIdentityMismatch(ctx),
      detectRapidMultiProvider(ctx),
      detectNoShowPattern(ctx),
      detectCashAnomaly(ctx),
      detectCrossProviderId(ctx),
      detectShortStayPattern(ctx),
      detectFakeIdPattern(ctx),
    ]);

    // Filter out nulls (no anomaly found) and save
    const anomalies = results.filter((r): r is AnomalyRecord => r !== null);

    if (anomalies.length === 0) return;

    // Save all anomalies
    for (const anomaly of anomalies) {
      try {
        await db.$executeRawUnsafe(
          `INSERT INTO "AnomalyRecord" ("id", "type", "severity", "riskScore", "guestName", "guestPhone", "guestIdNumber", "providerId", "providerName", "description", "metadata", "isReviewed", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          anomaly.id, anomaly.type, anomaly.severity, anomaly.riskScore,
          anomaly.guestName, anomaly.guestPhone, anomaly.guestIdNumber,
          anomaly.providerId, anomaly.providerName, anomaly.description,
          anomaly.metadata, anomaly.createdAt
        );
      } catch (e) {
        console.error("[anomaly] Failed to save:", e);
      }
    }

    console.log(`[anomaly] ${anomalies.length} anomaly(ies) detected for ${ctx.guestPhone || ctx.guestName || "unknown"} [${ctx.trigger}]`);

    // Auto-create notifications for HIGH/CRITICAL anomalies
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
    // NEVER throw — anomaly detection is background-only
    console.error("[anomaly] Detection run failed:", error);
  }
}

/**
 * Run system-wide anomaly scan (triggered manually by police).
 * Checks ALL guests across ALL providers.
 */
export async function runSystemWideScan(): Promise<{ scanned: number; anomalies: number }> {
  await ensureAnomalyTable();

  // Get all unique phone numbers with recent activity (last 90 days)
  const guests = await db.$queryRawUnsafe<{
    id: string; name: string; phone: string; idNumber: string; providerId: string;
  }[]>(
    `SELECT g."id", g."name", g."phone", g."idNumber", g."providerId"
     FROM "Guest" g
     WHERE g."createdAt" >= datetime('now', '-90 days')
       AND (g."phone" IS NOT NULL AND g."phone" != '')
     ORDER BY g."createdAt" DESC
     LIMIT 2000`
  );

  let anomalyCount = 0;
  // Process in batches to avoid overwhelming the connection
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
    anomalyCount += batch.length; // Approximate
  }

  // Get actual new anomaly count
  const recentAnomalies = await db.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*) as c FROM "AnomalyRecord" WHERE "createdAt" >= datetime('now', '-5 minutes')`
  );

  return { scanned: guests.length, anomalies: Number(recentAnomalies[0]?.c || 0) };
}

/**
 * Get anomaly statistics for a provider or system-wide.
 */
export async function getAnomalyStats(providerId?: string) {
  await ensureAnomalyTable();

  const where = providerId ? `WHERE "providerId" = '${providerId}'` : "";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [total, unreviewed, bySeverity, byType, recent] = await Promise.all([
    db.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*) as c FROM "AnomalyRecord" ${where}`),
    db.$queryRawUnsafe<{ c: number }[]>(`SELECT COUNT(*) as c FROM "AnomalyRecord" ${where ? where + " AND" : "WHERE"} "isReviewed" = 0`),
    db.$queryRawUnsafe<{ severity: string; count: number }[]>(
      `SELECT "severity", COUNT(*) as count FROM "AnomalyRecord" ${where} GROUP BY "severity"`
    ),
    db.$queryRawUnsafe<{ type: string; count: number }[]>(
      `SELECT "type", COUNT(*) as count FROM "AnomalyRecord" ${where} GROUP BY "type" ORDER BY count DESC`
    ),
    db.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*) as c FROM "AnomalyRecord" WHERE "createdAt" >= ?`, thirtyDaysAgo
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
