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
