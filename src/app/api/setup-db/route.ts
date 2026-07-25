import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // Create SuspectedPerson table
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

    // Create SuspectMatch table
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

    // Create index for performance
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SuspectMatch_suspectedPersonId_idx" ON "SuspectMatch"("suspectedPersonId");
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SuspectMatch_isRead_idx" ON "SuspectMatch"("isRead");
    `);

    // Create AuditLog table
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

    // Create Geofence table
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

    // Create FrequentStayAlert table
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

    // Create PoliceAlertConfig table
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

    // Ensure a default PoliceAlertConfig exists (idempotent)
    await db.$executeRawUnsafe(`
      INSERT OR IGNORE INTO "PoliceAlertConfig" ("id", "createdAt", "updatedAt")
      VALUES ('default-alert-config', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `);

    // Add latitude/longitude columns to Provider if missing
    await db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "latitude" REAL DEFAULT 9.02`).catch(() => {});
    await db.$executeRawUnsafe(`ALTER TABLE "Provider" ADD COLUMN "longitude" REAL DEFAULT 38.75`).catch(() => {});

    // Migrate stale data: any SUPERUSER with a providerId should be OPERATOR
    const migrated = await db.user.updateMany({
      where: { role: 'SUPERUSER', providerId: { not: null } },
      data: { role: 'OPERATOR' },
    });

    const message = migrated.count > 0
      ? `Tables created. Migrated ${migrated.count} SUPERUSER users to OPERATOR.`
      : 'Tables created. No stale data to migrate.';

    return NextResponse.json({
      success: true,
      tablesCreated: true,
      migratedCount: migrated.count,
      message,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[setup-db]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}