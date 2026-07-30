import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

type PrismaClientInstance = PrismaClient & { $disconnect: () => Promise<void> };

let _db: PrismaClientInstance | null = null;
let schemaReady = false;
let schemaPromise: Promise<void> | null = null;
let _anomalyToggleMigrated = false;

function createPrismaClient(): PrismaClientInstance {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl && tursoUrl.length > 0) {
    console.log("[db] Connecting to Turso cloud database");

    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: authToken || undefined,
    } as ConstructorParameters<typeof PrismaLibSQL>[0] & {
      connectTimeout?: number;
      requestTimeout?: number;
    });

    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "production"
        ? ["warn", "error"]
        : ["query", "warn", "error"],
    }) as PrismaClientInstance;

    return client;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[db] TURSO_DATABASE_URL is not set. " +
      "Add it in Vercel Dashboard > Settings > Environment Variables."
    );
  }

  console.log("[db] TURSO_DATABASE_URL not set — using local SQLite");
  return new PrismaClient() as PrismaClientInstance;
}

// ── SQL statements for full migration (only runs on fresh DB) ──
const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS "SuspectedPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL, "phone" TEXT NOT NULL DEFAULT '',
    "idNumber" TEXT NOT NULL DEFAULT '', "idType" TEXT NOT NULL DEFAULT '',
    "nationality" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '', "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "is_active" BOOLEAN NOT NULL DEFAULT 1, "registeredBy" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "SuspectMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "suspectedPersonId" TEXT NOT NULL, "matchType" TEXT NOT NULL,
    "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL DEFAULT '',
    "guestIdNumber" TEXT NOT NULL DEFAULT '', "providerName" TEXT NOT NULL DEFAULT '',
    "providerId" TEXT NOT NULL DEFAULT '', "reservationId" TEXT, "daytimeBookingId" TEXT,
    "details" TEXT NOT NULL DEFAULT '', "isRead" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("suspectedPersonId") REFERENCES "SuspectedPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "officerName" TEXT NOT NULL DEFAULT '', "action" TEXT NOT NULL,
    "targetId" TEXT, "targetType" TEXT NOT NULL DEFAULT '',
    "details" TEXT, "ipAddress" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "Geofence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL, "address" TEXT NOT NULL DEFAULT '',
    "latitude" REAL NOT NULL DEFAULT 0, "longitude" REAL NOT NULL DEFAULT 0,
    "radius" REAL NOT NULL DEFAULT 1000, "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "FrequentStayAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL DEFAULT '',
    "guestIdNumber" TEXT NOT NULL DEFAULT '', "providerNames" TEXT NOT NULL DEFAULT '[]',
    "stayCount" INTEGER NOT NULL DEFAULT 0, "avgDaysBetween" REAL NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM', "isReviewed" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`,
  `CREATE TABLE IF NOT EXISTS "PoliceAlertConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT 0, "emailRecipients" TEXT NOT NULL DEFAULT '[]',
    "smsEnabled" BOOLEAN NOT NULL DEFAULT 0, "smsRecipients" TEXT NOT NULL DEFAULT '[]',
    "escalationDelayMins" INTEGER NOT NULL DEFAULT 60, "criticalImmediate" BOOLEAN NOT NULL DEFAULT 1,
    "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY, "providerId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL, "endDate" DATETIME NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'MONTHLY', "price" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_providerId_key" UNIQUE ("providerId"),
    FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
    "id" TEXT NOT NULL PRIMARY KEY, "subscriptionId" TEXT NOT NULL,
    "amount" REAL NOT NULL, "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "periodStart" DATETIME NOT NULL, "periodEnd" DATETIME NOT NULL,
    "markedBy" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,
];

const CREATE_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS "Provider_status_idx" ON "Provider"("status")`,
  `CREATE INDEX IF NOT EXISTS "Provider_createdAt_idx" ON "Provider"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "User_providerId_idx" ON "User"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role")`,
  `CREATE INDEX IF NOT EXISTS "Room_providerId_idx" ON "Room"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Room_status_idx" ON "Room"("status")`,
  `CREATE INDEX IF NOT EXISTS "Guest_providerId_idx" ON "Guest"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Guest_phone_idx" ON "Guest"("phone")`,
  `CREATE INDEX IF NOT EXISTS "Guest_idNumber_idx" ON "Guest"("idNumber")`,
  `CREATE INDEX IF NOT EXISTS "Guest_createdAt_idx" ON "Guest"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Guest_name_idx" ON "Guest"("name")`,
  `CREATE INDEX IF NOT EXISTS "Reservation_providerId_idx" ON "Reservation"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Reservation_guestId_idx" ON "Reservation"("guestId")`,
  `CREATE INDEX IF NOT EXISTS "Reservation_roomId_idx" ON "Reservation"("roomId")`,
  `CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"("status")`,
  `CREATE INDEX IF NOT EXISTS "Reservation_createdAt_idx" ON "Reservation"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Reservation_checkIn_idx" ON "Reservation"("checkIn")`,
  `CREATE INDEX IF NOT EXISTS "DaytimeService_providerId_idx" ON "DaytimeService"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "DaytimeBooking_providerId_idx" ON "DaytimeBooking"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "DaytimeBooking_serviceId_idx" ON "DaytimeBooking"("serviceId")`,
  `CREATE INDEX IF NOT EXISTS "DaytimeBooking_date_idx" ON "DaytimeBooking"("date")`,
  `CREATE INDEX IF NOT EXISTS "Expense_providerId_idx" ON "Expense"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date")`,
  `CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category")`,
  `CREATE INDEX IF NOT EXISTS "Resource_providerId_idx" ON "Resource"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Resource_category_idx" ON "Resource"("category")`,
  `CREATE INDEX IF NOT EXISTS "Payment_providerId_idx" ON "Payment"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Payment_reservationId_idx" ON "Payment"("reservationId")`,
  `CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Notification_providerId_idx" ON "Notification"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead")`,
  `CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "HousekeepingTask_providerId_idx" ON "HousekeepingTask"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "HousekeepingTask_status_idx" ON "HousekeepingTask"("status")`,
  `CREATE INDEX IF NOT EXISTS "Review_guestId_idx" ON "Review"("guestId")`,
  `CREATE INDEX IF NOT EXISTS "Review_reservationId_idx" ON "Review"("reservationId")`,
  `CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ActivityLog_providerId_idx" ON "ActivityLog"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Settings_providerId_idx" ON "Settings"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "SuspectedPerson_name_idx" ON "SuspectedPerson"("name")`,
  `CREATE INDEX IF NOT EXISTS "SuspectedPerson_phone_idx" ON "SuspectedPerson"("phone")`,
  `CREATE INDEX IF NOT EXISTS "SuspectedPerson_severity_idx" ON "SuspectedPerson"("severity")`,
  `CREATE INDEX IF NOT EXISTS "SuspectMatch_suspectedPersonId_idx" ON "SuspectMatch"("suspectedPersonId")`,
  `CREATE INDEX IF NOT EXISTS "SuspectMatch_isRead_idx" ON "SuspectMatch"("isRead")`,
  `CREATE INDEX IF NOT EXISTS "SuspectMatch_createdAt_idx" ON "SuspectMatch"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "Geofence_isActive_idx" ON "Geofence"("isActive")`,
  `CREATE INDEX IF NOT EXISTS "Subscription_providerId_idx" ON "Subscription"("providerId")`,
  `CREATE INDEX IF NOT EXISTS "Subscription_endDate_idx" ON "Subscription"("endDate")`,
];

/**
 * Auto-migrate: ensure police tables + columns exist.
 *
 * Performance strategy:
 *  FAST PATH (existing DB): 1 PRAGMA call → done (~150ms)
 *  SLOW PATH (fresh DB): full migration (~2-3s, runs once ever)
 */
async function ensureSchema(db: PrismaClientInstance) {
  if (schemaReady) return;
  try {
    // ── FAST PATH: Single PRAGMA check ──
    // "suspendedBy" is the LAST column we add via ALTER TABLE.
    // If it exists, ALL prior migrations (tables, columns, indexes) are already done.
    const providerCols = await db.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("Provider")`
    );

    if (providerCols.some(c => c.name === "suspendedBy")) {
      // DB is fully migrated — skip everything
      schemaReady = true;
      console.log("[db] Schema already migrated (fast path, 1 query)");
      return;
    }

    // ── SLOW PATH: Full migration (fresh DB only) ──
    console.log("[db] Running full schema migration...");

    // Phase 1: Create all police tables in parallel
    await Promise.all(
      CREATE_TABLES_SQL.map(sql => db.$executeRawUnsafe(sql))
    );

    // Phase 2: Default PoliceAlertConfig
    await db.$executeRawUnsafe(`
      INSERT OR IGNORE INTO "PoliceAlertConfig" ("id", "createdAt", "updatedAt")
      VALUES ('default-alert-config', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    // Phase 3: Add missing columns to Provider and User
    const [pCols, uCols] = await Promise.all([
      db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Provider")`),
      db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("User")`),
    ]);
    const pSet = new Set(pCols.map(c => c.name));
    const uSet = new Set(uCols.map(c => c.name));

    const alters: Promise<unknown>[] = [];
    if (!pSet.has("latitude"))       alters.push(db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "latitude" REAL DEFAULT 9.02`));
    if (!pSet.has("longitude"))      alters.push(db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "longitude" REAL DEFAULT 38.75`));
    if (!pSet.has("suspensionReason")) alters.push(db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "suspensionReason" TEXT NOT NULL DEFAULT ''`));
    if (!pSet.has("suspendedAt"))    alters.push(db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "suspendedAt" DATETIME`));
    if (!pSet.has("suspendedBy"))    alters.push(db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "suspendedBy" TEXT NOT NULL DEFAULT ''`));
    if (!uSet.has("policeRank"))     alters.push(db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "policeRank" TEXT DEFAULT ''`));

    // Phase 3b: Add anomalyDetectionEnabled to PoliceAlertConfig
    const pacCols = await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("PoliceAlertConfig")`);
    const pacSet = new Set(pacCols.map(c => c.name));
    if (!pacSet.has("anomalyDetectionEnabled")) {
      alters.push(db.$executeRawUnsafe(`ALTER TABLE "PoliceAlertConfig" ADD COLUMN "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT 0`));
    }

    if (alters.length > 0) await Promise.all(alters);

    // Phase 4: Create indexes (only on fresh DB)
    // Batch of 15 for parallel execution
    for (let i = 0; i < CREATE_INDEXES_SQL.length; i += 15) {
      await Promise.all(
        CREATE_INDEXES_SQL.slice(i, i + 15).map(s =>
          db.$executeRawUnsafe(s).catch(e => console.warn("[db] Index skipped:", (e as Error).message))
        )
      );
    }
    console.log(`[db] Full migration complete (${CREATE_INDEXES_SQL.length} indexes created)`);

    schemaReady = true;
  } catch (error) {
    console.error("[db] Schema auto-migration failed (non-blocking):", error);
    schemaReady = true; // Don't retry on every request
  }
}

/**
 * Lightweight migration for new columns added after the fast-path checkpoint.
 * Runs once per cold start, only if the column doesn't exist yet.
 * Uses PRAGMA table_info (single query) to check, then ALTER TABLE if needed.
 */
export async function ensureAnomalyToggleColumn(client: PrismaClientInstance): Promise<void> {
  if (_anomalyToggleMigrated) return;
  try {
    const cols = await client.$queryRawUnsafe<{ name: string }[]>(
      `PRAGMA table_info("PoliceAlertConfig")`
    );
    const has = cols.some(c => c.name === "anomalyDetectionEnabled");
    if (!has) {
      await client.$executeRawUnsafe(
        `ALTER TABLE "PoliceAlertConfig" ADD COLUMN "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT 0`
      );
      console.log("[db] Added anomalyDetectionEnabled column to PoliceAlertConfig");
    }
    _anomalyToggleMigrated = true;
  } catch (e) {
    console.warn("[db] anomalyToggle migration skipped (non-blocking):", e);
    _anomalyToggleMigrated = true; // Don't retry
  }
}

function getDb(): PrismaClientInstance {
  if (!_db) {
    _db = createPrismaClient();
    schemaReady = false;
    schemaPromise = ensureSchema(_db);
  }
  return _db;
}

/**
 * Returns the DB client only after schema migration is complete.
 */
export async function getDbReady(): Promise<PrismaClientInstance> {
  const client = getDb();
  if (!schemaReady && schemaPromise) {
    await schemaPromise;
  }
  return client;
}

/**
 * Lazy Proxy that auto-awaits schema readiness before ANY query.
 * Every Prisma method call (findMany, create, etc.) will first ensure
 * the schema migration is complete — no race conditions on cold start.
 */
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      // Return an async wrapper that awaits schema before executing
      return async (...args: unknown[]) => {
        if (!schemaReady && schemaPromise) {
          await schemaPromise;
        }
        return (value as (...a: unknown[]) => Promise<unknown>).apply(client, args);
      };
    }
    return value;
  },
});