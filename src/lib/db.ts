import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

type PrismaClientInstance = PrismaClient & { $disconnect: () => Promise<void> };

let _db: PrismaClientInstance | null = null;
let schemaEnsured = false;

function createPrismaClient(): PrismaClientInstance {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl && tursoUrl.length > 0) {
    console.log("[db] Connecting to Turso cloud database");
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: authToken || undefined });
    return new PrismaClient({ adapter }) as PrismaClientInstance;
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
 */
async function ensureSchema(db: PrismaClientInstance) {
  if (schemaEnsured) return;
  try {
    // ── Police tables (CREATE IF NOT EXISTS) ──
    await db.$executeRawUnsafe(`
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
    `);
    await db.$executeRawUnsafe(`
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
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SuspectMatch_suspectedPersonId_idx" ON "SuspectMatch"("suspectedPersonId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SuspectMatch_isRead_idx" ON "SuspectMatch"("isRead")`);

    await db.$executeRawUnsafe(`
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
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`);

    await db.$executeRawUnsafe(`
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
    `);

    await db.$executeRawUnsafe(`
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
    `);

    await db.$executeRawUnsafe(`
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
    `);
    // Ensure a default PoliceAlertConfig exists
    await db.$executeRawUnsafe(`
      INSERT OR IGNORE INTO "PoliceAlertConfig" ("id", "createdAt", "updatedAt")
      VALUES ('default-alert-config', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    // ── Provider columns ──
    const providerCols: { name: string }[] = await db.$queryRawUnsafe(`PRAGMA table_info("Provider")`);
    const pColNames = providerCols.map(c => c.name);

    if (!pColNames.includes("latitude")) {
      await db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "latitude" REAL DEFAULT 9.02`);
      console.log("[db] Added latitude column to Provider");
    }
    if (!pColNames.includes("longitude")) {
      await db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "longitude" REAL DEFAULT 38.75`);
      console.log("[db] Added longitude column to Provider");
    }

    // ── User columns ──
    const userCols: { name: string }[] = await db.$queryRawUnsafe(`PRAGMA table_info("User")`);
    const uColNames = userCols.map(c => c.name);

    if (!uColNames.includes("policeRank")) {
      await db.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "policeRank" TEXT DEFAULT ''`);
      console.log("[db] Added policeRank column to User");
    }

    // ── Production-critical indexes (idempotent) ──
    // These mirror the @@index directives in prisma/schema.prisma.
    // Running CREATE INDEX IF NOT EXISTS on every cold start is cheap and
    // ensures production Turso gets the indexes without a manual db push.
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
      // SuspectMatch (extends existing indexes)
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_createdAt_idx" ON "SuspectMatch"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_guestPhone_idx" ON "SuspectMatch"("guestPhone")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_guestIdNumber_idx" ON "SuspectMatch"("guestIdNumber")`,
      `CREATE INDEX IF NOT EXISTS "SuspectMatch_providerId_idx" ON "SuspectMatch"("providerId")`,
      // AuditLog (extends existing indexes)
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
    ];

    for (const stmt of indexStatements) {
      try {
        await db.$executeRawUnsafe(stmt);
      } catch (err) {
        // Index may already exist or column may not exist yet — non-fatal
        console.warn("[db] Index creation skipped:", (err as Error).message);
      }
    }

    schemaEnsured = true;
    console.log("[db] Schema auto-migration complete");
  } catch (error) {
    console.error("[db] Schema auto-migration failed (non-blocking):", error);
    schemaEnsured = true; // Don't retry on every request
  }
}

function getDb(): PrismaClientInstance {
  if (!_db) {
    _db = createPrismaClient();
    // Fire-and-forget schema check
    ensureSchema(_db).catch(() => {});
  }
  return _db;
}

// Lazy Proxy — PrismaClient is created on first use (request time), not at module load time
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
