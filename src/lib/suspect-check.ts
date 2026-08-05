import { db } from "./db";
import { Prisma } from "@prisma/client";
import { dispatchAlertForMatch } from "./alert-dispatcher";

let tablesEnsured = false;

/**
 * Ensure the SuspectMatch and SuspectedPerson tables exist.
 * Runs once per cold start. Uses raw SQL for PostgreSQL compatibility.
 */
async function ensureTables() {
  if (tablesEnsured) return;
  try {
    await db.suspectedPerson.count();
    tablesEnsured = true;
  } catch {
    // Table doesn't exist — create them
    console.log("[suspect-check] Creating SuspectedPerson and SuspectMatch tables...");
    await db.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS "SuspectedPerson" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "phone" TEXT NOT NULL DEFAULT '',
        "idNumber" TEXT NOT NULL DEFAULT '',
        "idType" TEXT NOT NULL DEFAULT '',
        "nationality" TEXT NOT NULL DEFAULT '',
        "gender" TEXT NOT NULL DEFAULT '',
        "age" TEXT NOT NULL DEFAULT '',
        "dateOfBirth" TEXT NOT NULL DEFAULT '',
        "occupation" TEXT NOT NULL DEFAULT '',
        "address" TEXT NOT NULL DEFAULT '',
        "lastSeenLocation" TEXT NOT NULL DEFAULT '',
        "photoUrl" TEXT NOT NULL DEFAULT '',
        "caseNumber" TEXT NOT NULL DEFAULT '',
        "wantedDate" TEXT NOT NULL DEFAULT '',
        "description" TEXT NOT NULL DEFAULT '',
        "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "registeredBy" TEXT NOT NULL DEFAULT '',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL
      );
    `);
    await db.$executeRaw(Prisma.sql`
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
        "isRead" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("suspectedPersonId") REFERENCES "SuspectedPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    await db.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS "SuspectMatch_suspectedPersonId_idx" ON "SuspectMatch"("suspectedPersonId");
    `);
    await db.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS "SuspectMatch_isRead_idx" ON "SuspectMatch"("isRead");
    `);
    tablesEnsured = true;
    console.log("[suspect-check] Tables created successfully");
  }
}

/**
 * Check if a person (by name, phone, or ID number) matches any suspected person.
 * If matches are found, creates SuspectMatch records silently (no error thrown).
 * This is called in the background after reservation/booking creation.
 */
export async function checkSuspectMatch(params: {
  name: string;
  phone?: string;
  idNumber?: string;
  matchType: string; // "RESERVATION", "DAYTIME_BOOKING", "GUEST_CHECKIN"
  providerId: string;
  providerName?: string;
  reservationId?: string;
  daytimeBookingId?: string;
  extraDetails?: Record<string, unknown>;
}) {
  try {
    await ensureTables();

    const { name, phone, idNumber, matchType, providerId, providerName, reservationId, daytimeBookingId, extraDetails } = params;

    // Build search conditions: match on name, phone, or ID number
    const orConditions: Record<string, unknown>[] = [];

    if (name) {
      // Split name into parts and search by first/last name
      const nameParts = name.trim().toLowerCase().split(/\s+/);
      if (nameParts.length >= 2) {
        // Try matching last name (most identifying)
        orConditions.push({ name: { contains: nameParts[nameParts.length - 1] } });
      }
      orConditions.push({ name: { contains: name } });
    }
    if (phone && phone.length >= 4) {
      orConditions.push({ phone: { contains: phone } });
    }
    if (idNumber && idNumber.length >= 2) {
      orConditions.push({ idNumber: { contains: idNumber } });
    }

    if (orConditions.length === 0) return;

    const suspects = await db.suspectedPerson.findMany({
      where: {
        is_active: true,
        OR: orConditions,
      },
    });

    if (suspects.length === 0) return;

    // Get provider name if not provided
    let provName = providerName || "";
    if (!provName) {
      const provider = await db.provider.findUnique({ where: { id: providerId }, select: { name: true } });
      provName = provider?.name || "";
    }

    // Build detail string with all relevant information
    const details = JSON.stringify({
      matchType,
      guestName: name,
      guestPhone: phone || "",
      guestIdNumber: idNumber || "",
      providerName: provName,
      providerId,
      reservationId: reservationId || null,
      daytimeBookingId: daytimeBookingId || null,
      matchedAt: new Date().toISOString(),
      ...extraDetails,
    });

    // Create a match record for each suspect found
    for (const suspect of suspects) {
      const match = await db.suspectMatch.create({
        data: {
          suspectedPersonId: suspect.id,
          matchType,
          guestName: name,
          guestPhone: phone || "",
          guestIdNumber: idNumber || "",
          providerName: provName,
          providerId,
          reservationId: reservationId || null,
          daytimeBookingId: daytimeBookingId || null,
          details,
        },
      });

      // Fire-and-forget alert dispatch — never blocks or breaks normal flow
      dispatchAlertForMatch(
        {
          id: suspect.id,
          name: suspect.name,
          severity: suspect.severity,
          is_active: suspect.is_active,
        },
        {
          matchId: match.id,
          providerId: match.providerId,
          providerName: match.providerName,
          guestName: match.guestName,
          guestPhone: match.guestPhone,
          guestIdNumber: match.guestIdNumber,
          matchType: match.matchType,
          details: match.details,
        }
      ).catch(() => {});
    }
  } catch (error) {
    // Log but never throw — suspect checking should not break normal operations
    console.error("[suspect-check] Background check failed:", error);
  }
}

/**
 * Ensure tables exist — can be called from API routes too.
 */
export async function ensureSuspectTables() {
  await ensureTables();
}
