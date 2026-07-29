import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

type PrismaClientInstance = PrismaClient & { $disconnect: () => Promise<void> };

let _db: PrismaClientInstance | null = null;
let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

/**
 * Create a Prisma client with connection pooling optimizations.
 *
 * Turso LibSQL supports `syncUrl` for embedded replicas which reduces
 * latency on read-heavy workloads.  We also configure log levels and
 * query-timeout so slow queries are visible in Vercel logs.
 */
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
    // Set connection/request timeouts to avoid hanging on slow Turso responses
    // @ts-expect-error LibSQL client supports these options
    adapter.libSqlClient?.config && Object.assign(adapter.libSqlClient.config, {
      connectTimeout: 5000,
      // requestTimeout handled via Prisma's query timeout below
    });

    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "production"
        ? ["warn", "error"]
        : ["query", "warn", "error"],
      // Default query timeout: 15s — prevents hung queries on Vercel serverless
      queryTimeout: 15_000,
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

/**
 * Auto-migrate: ensure all police tables exist and columns are added.
 * Uses CREATE TABLE IF NOT EXISTS + PRAGMA checks — runs once per cold start.
 *
 * Optimizations vs. original:
 *  - All CREATE TABLE statements run in parallel via Promise.all
 *  - All index statements run in parallel via Promise.all
 *  - PRAGMA checks batched into fewer round-trips
 */
async function ensureSchema(db: PrismaClientInstance) {
  if (schemaEnsured) return;
  try {
    // ── Phase 1: Create all tables in parallel ──
    await Promise.all([
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SuspectedPerson" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "phone" TEXT NOT NULL DEFAULT '',
          "idNumber" TEXT NOT NULL DEFAULT '',
          "idType" TEXT NOT NULL DEFAULT '',
          "nationality" TEXT NOT NULL DEFAULT '',
          "address" TEXT NOT NULL DEFAULT '',
          "description" TEXT NOT NULL DEFAULT '',
          "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
          "is_active" BOOLEAN NOT NULL DEFAULT 1,
          "registeredBy" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `),
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SuspectMatch" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "suspectedPersonId" TEXT NOT NULL,
          "matchType" TEXT NOT NULL,
          "guestName" TEXT NOT NULL,
          "guestPhone" TEXT NOT NULL DEFAULT '',
          "guestIdNumber" TEXT NOT NULL DEFAULT '',
          "providerName" TEXT NOT NULL DEFAULT '',
          "providerId" TEXT NOT NULL DEFAULT '',
          "reservationId" TEXT,
          "daytimeBookingId" TEXT,
          "details" TEXT NOT NULL DEFAULT '',
          "isRead" BOOLEAN NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("suspectedPersonId") REFERENCES "SuspectedPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `),
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "AuditLog" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "officerName" TEXT NOT NULL DEFAULT '',
          "action" TEXT NOT NULL,
          "targetId" TEXT,
          "targetType" TEXT NOT NULL DEFAULT '',
          "details" TEXT,
          "ipAddress" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `),
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Geofence" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "address" TEXT NOT NULL DEFAULT '',
          "latitude" REAL NOT NULL DEFAULT 0,
          "longitude" REAL NOT NULL DEFAULT 0,
          "radius" REAL NOT NULL DEFAULT 1000,
          "severity" TEXT NOT NULL DEFAULT 'HIGH',
          "isActive" BOOLEAN NOT NULL DEFAULT 1,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `),
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "FrequentStayAlert" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "guestName" TEXT NOT NULL,
          "guestPhone" TEXT NOT NULL DEFAULT '',
          "guestIdNumber" TEXT NOT NULL DEFAULT '',
          "providerNames" TEXT NOT NULL DEFAULT '[]',
          "stayCount" INTEGER NOT NULL DEFAULT 0,
          "avgDaysBetween" REAL NOT NULL DEFAULT 0,
          "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
          "isReviewed" BOOLEAN NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `),
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PoliceAlertConfig" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "emailEnabled" BOOLEAN NOT NULL DEFAULT 0,
          "emailRecipients" TEXT NOT NULL DEFAULT '[]',
          "smsEnabled" BOOLEAN NOT NULL DEFAULT 0,
          "smsRecipients" TEXT NOT NULL DEFAULT '[]',
          "escalationDelayMins" INTEGER NOT NULL DEFAULT 60,
          "criticalImmediate" BOOLEAN NOT NULL DEFAULT 1,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );
      `),
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Subscription" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "providerId" TEXT NOT NULL,
          "startDate" DATETIME NOT NULL,
          "endDate" DATETIME NOT NULL,
          "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
          "price" REAL NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Subscription_providerId_key" UNIQUE ("providerId"),
          FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `),
      db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "subscriptionId" TEXT NOT NULL,
          "amount" REAL NOT NULL,
          "cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
          "periodStart" DATETIME NOT NULL,
          "periodEnd" DATETIME NOT NULL,
          "markedBy" TEXT NOT NULL DEFAULT '',
          "notes" TEXT NOT NULL DEFAULT '',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `),
    ]);

    // ── Phase 2: Ensure default PoliceAlertConfig exists ──
    await db.$executeRawUnsafe(`
      INSERT OR IGNORE INTO "PoliceAlertConfig" ("id", "createdAt", "updatedAt")
      VALUES ('default-alert-config', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    // ── Phase 3: Check and add missing columns (Provider + User) ──
    const [providerCols, userCols] = await Promise.all([
      db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Provider")`),
      db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("User")`),
    ]);
    const pColNames = new Set(providerCols.map(c => c.name));
    const uColNames = new Set(userCols.map(c => c.name));

    const providerAlters: Promise<unknown>[] = [];
    if (!pColNames.has("latitude")) {
      providerAlters.push(
        db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "latitude" REAL DEFAULT 9.02`).then(() => console.log("[db] Added latitude column to Provider"))
      );
    }
    if (!pColNames.has("longitude")) {
      providerAlters.push(
        db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "longitude" REAL DEFAULT 38.75`).then(() => console.log("[db] Added longitude column to Provider"))
      );
    }
    if (!pColNames.has("suspensionReason")) {
      providerAlters.push(
        db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "suspensionReason" TEXT NOT NULL DEFAULT ''`).then(() => console.log("[db] Added suspensionReason column to Provider"))
      );
    }
    if (!pColNames.has("suspendedAt")) {
      providerAlters.push(
        db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "suspendedAt" DATETIME`).then(() => console.log("[db] Added suspendedAt column to Provider"))
      );
    }
    if (!pColNames.has("suspendedBy")) {
      providerAlters.push(
        db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "suspendedBy" TEXT NOT NULL DEFAULT ''`).then(() => console.log("[db] Added suspendedBy column to Provider"))
      );
    }
    if (!uColNames.has("policeRank")) {
      providerAlters.push(
        db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "policeRank" TEXT DEFAULT ''`).then(() => console.log("[db] Added policeRank column to User"))
      );
    }
    if (providerAlters.length > 0) {
      await Promise.all(providerAlters);
    }

    // ── Phase 4: Create indexes in smaller batches to avoid overwhelming Turso ──
    const indexStatements = [
      // Provider
      `CREATE INDEX IF NOT EXISTS "Provider_status_idx" ON "Provider"("status")`,
      `CREATE INDEX IF NOT EXISTS "Provider_createdAt_idx" ON "Provider"("createdAt")`,
      // User
      `CREATE INDEX IF NOT EXISTS "User_providerId_idx" ON "User"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role")`,
      // Room
      `CREATE INDEX IF NOT EXISTS "Room_providerId_idx" ON "Room"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Room_status_idx" ON "Room"("status")`,
      // Guest
      `CREATE INDEX IF NOT EXISTS "Guest_providerId_idx" ON "Guest"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Guest_phone_idx" ON "Guest"("phone")`,
      `CREATE INDEX IF NOT EXISTS "Guest_idNumber_idx" ON "Guest"("idNumber")`,
      `CREATE INDEX IF NOT EXISTS "Guest_email_idx" ON "Guest"("email")`,
      `CREATE INDEX IF NOT EXISTS "Guest_createdAt_idx" ON "Guest"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "Guest_name_idx" ON "Guest"("name")`,
      // Reservation
      `CREATE INDEX IF NOT EXISTS "Reservation_providerId_idx" ON "Reservation"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Reservation_guestId_idx" ON "Reservation"("guestId")`,
      `CREATE INDEX IF NOT EXISTS "Reservation_roomId_idx" ON "Reservation"("roomId")`,
      `CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"("status")`,
      `CREATE INDEX IF NOT EXISTS "Reservation_createdAt_idx" ON "Reservation"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "Reservation_checkIn_idx" ON "Reservation"("checkIn")`,
      // DaytimeService
      `CREATE INDEX IF NOT EXISTS "DaytimeService_providerId_idx" ON "DaytimeService"("providerId")`,
      // DaytimeBooking
      `CREATE INDEX IF NOT EXISTS "DaytimeBooking_providerId_idx" ON "DaytimeBooking"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "DaytimeBooking_serviceId_idx" ON "DaytimeBooking"("serviceId")`,
      `CREATE INDEX IF NOT EXISTS "DaytimeBooking_guestPhone_idx" ON "DaytimeBooking"("guestPhone")`,
      `CREATE INDEX IF NOT EXISTS "DaytimeBooking_date_idx" ON "DaytimeBooking"("date")`,
      `CREATE INDEX IF NOT EXISTS "DaytimeBooking_createdAt_idx" ON "DaytimeBooking"("createdAt")`,
      // Expense
      `CREATE INDEX IF NOT EXISTS "Expense_providerId_idx" ON "Expense"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date")`,
      `CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category")`,
      // Resource
      `CREATE INDEX IF NOT EXISTS "Resource_providerId_idx" ON "Resource"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Resource_category_idx" ON "Resource"("category")`,
      // Payment
      `CREATE INDEX IF NOT EXISTS "Payment_providerId_idx" ON "Payment"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Payment_reservationId_idx" ON "Payment"("reservationId")`,
      `CREATE INDEX IF NOT EXISTS "Payment_daytimeBookingId_idx" ON "Payment"("daytimeBookingId")`,
      `CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt")`,
      // Notification
      `CREATE INDEX IF NOT EXISTS "Notification_providerId_idx" ON "Notification"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId")`,
      `CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead")`,
      `CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt")`,
      // HousekeepingTask
      `CREATE INDEX IF NOT EXISTS "HousekeepingTask_providerId_idx" ON "HousekeepingTask"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "HousekeepingTask_roomId_idx" ON "HousekeepingTask"("roomId")`,
      `CREATE INDEX IF NOT EXISTS "HousekeepingTask_status_idx" ON "HousekeepingTask"("status")`,
      `CREATE INDEX IF NOT EXISTS "HousekeepingTask_scheduledDate_idx" ON "HousekeepingTask"("scheduledDate")`,
      // Review
      `CREATE INDEX IF NOT EXISTS "Review_guestId_idx" ON "Review"("guestId")`,
      `CREATE INDEX IF NOT EXISTS "Review_reservationId_idx" ON "Review"("reservationId")`,
      `CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review"("createdAt")`,
      // ActivityLog
      `CREATE INDEX IF NOT EXISTS "ActivityLog_providerId_idx" ON "ActivityLog"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt")`,
      // Settings
      `CREATE INDEX IF NOT EXISTS "Settings_providerId_idx" ON "Settings"("providerId")`,
      // SuspectedPerson
      `CREATE INDEX IF NOT EXISTS "SuspectedPerson_name_idx" ON "SuspectedPerson"("name")`,
      `CREATE INDEX IF NOT EXISTS "SuspectedPerson_phone_idx" ON "SuspectedPerson"("phone")`,
      `CREATE INDEX IF NOT EXISTS "SuspectedPerson_idNumber_idx" ON "SuspectedPerson"("idNumber")`,
      `CREATE INDEX IF NOT EXISTS "SuspectedPerson_severity_idx" ON "SuspectedPerson"("severity")`,
      `CREATE INDEX IF NOT EXISTS "SuspectedPerson_is_active_idx" ON "SuspectedPerson"("is_active")`,
      // SuspectMatch
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_suspectedPersonId_idx" ON "SuspectMatch"("suspectedPersonId")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_isRead_idx" ON "SuspectMatch"("isRead")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_createdAt_idx" ON "SuspectMatch"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_guestPhone_idx" ON "SuspectMatch"("guestPhone")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_guestIdNumber_idx" ON "SuspectMatch"("guestIdNumber")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_providerId_idx" ON "SuspectMatch"("providerId")`,
      // AuditLog
      `CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`,
      `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "AuditLog_officerName_idx" ON "AuditLog"("officerName")`,
      // Geofence
      `CREATE INDEX IF NOT EXISTS "Geofence_isActive_idx" ON "Geofence"("isActive")`,
      `CREATE INDEX IF NOT EXISTS "Geofence_severity_idx" ON "Geofence"("severity")`,
      // FrequentStayAlert
      `CREATE INDEX IF NOT EXISTS "FrequentStayAlert_createdAt_idx" ON "FrequentStayAlert"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "FrequentStayAlert_isReviewed_idx" ON "FrequentStayAlert"("isReviewed")`,
      `CREATE INDEX IF NOT EXISTS "FrequentStayAlert_riskLevel_idx" ON "FrequentStayAlert"("riskLevel")`,
      `CREATE INDEX IF NOT EXISTS "FrequentStayAlert_guestPhone_idx" ON "FrequentStayAlert"("guestPhone")`,
      `CREATE INDEX IF NOT EXISTS "FrequentStayAlert_guestIdNumber_idx" ON "FrequentStayAlert"("guestIdNumber")`,
      // Subscription
      `CREATE INDEX IF NOT EXISTS "Subscription_providerId_idx" ON "Subscription"("providerId")`,
      `CREATE INDEX IF NOT EXISTS "Subscription_endDate_idx" ON "Subscription"("endDate")`,
      // SubscriptionPayment
      `CREATE INDEX IF NOT EXISTS "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId")`,
      `CREATE INDEX IF NOT EXISTS "SubscriptionPayment_createdAt_idx" ON "SubscriptionPayment"("createdAt")`,
    ];

    // Batch indexes into groups of 10 to limit concurrent Turso connections
    const BATCH_SIZE = 10;
    for (let i = 0; i < indexStatements.length; i += BATCH_SIZE) {
      const batch = indexStatements.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((stmt) =>
          db.$executeRawUnsafe(stmt).catch((err) => {
            console.warn("[db] Index skipped:", (err as Error).message);
          })
        )
      );
    }

    schemaEnsured = true;
    console.log("[db] Schema auto-migration complete (parallel)");
  } catch (error) {
    console.error("[db] Schema auto-migration failed (non-blocking):", error);
    schemaEnsured = true; // Don't retry on every request
  }
}

function getDb(): PrismaClientInstance {
  if (!_db) {
    _db = createPrismaClient();
    schemaEnsured = false;
    schemaPromise = ensureSchema(_db);
  }
  return _db;
}

/**
 * Returns the DB client only after schema migration is complete.
 * Use this in API routes to prevent cold-start race conditions.
 */
export async function getDbReady(): Promise<PrismaClientInstance> {
  const client = getDb();
  if (!schemaEnsured && schemaPromise) {
    await schemaPromise;
  }
  return client;
}

// Lazy Proxy — PrismaClient is created on first use (request time), not at module load time.
// NOTE: For API routes, prefer `getDbReady()` to avoid cold-start race conditions.
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
