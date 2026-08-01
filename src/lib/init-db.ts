import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

// All DDL in one place — enums, tables, FKs, indexes
const FULL_DDL = `
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('POLICE','SUPERUSER','OPERATOR','STAFF'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ProviderStatus" AS ENUM ('PENDING','APPROVED','REJECTED','SUSPENDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RoomType" AS ENUM ('SINGLE','DOUBLE','TWIN','SUITE','DELUXE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE','OCCUPIED','MAINTENANCE','RESERVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentStatusType" AS ENUM ('PAID','PARTIAL','PENDING'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMethodType" AS ENUM ('CASH','TRANSFER','CARD','MOBILE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ReservationStatus" AS ENUM ('UPCOMING','ACTIVE','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "NotificationType" AS ENUM ('INFO','WARNING','SUCCESS','ERROR'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "HousekeepingTaskType" AS ENUM ('CLEANING','MAINTENANCE','INSPECTION'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('PENDING','IN_PROGRESS','COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SuspectSeverity" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SubscriptionCycle" AS ENUM ('MONTHLY','QUARTERLY','SEMI_ANNUAL','YEARLY'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Provider" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "ownerName" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '', "type" TEXT NOT NULL DEFAULT 'GUEST_HOUSE', "licenseNo" TEXT NOT NULL DEFAULT '', "licenseFile" TEXT NOT NULL DEFAULT '', "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING', "latitude" DOUBLE PRECISION NOT NULL DEFAULT 9.02, "longitude" DOUBLE PRECISION NOT NULL DEFAULT 38.75, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3), "rejectionReason" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "username" TEXT NOT NULL, "password" TEXT NOT NULL, "role" "UserRole" NOT NULL DEFAULT 'STAFF', "name" TEXT NOT NULL, "permissions" TEXT NOT NULL DEFAULT '["reservations","guests"]', "policeRank" TEXT NOT NULL DEFAULT '', "providerId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "User_username_key" UNIQUE ("username"));
CREATE TABLE IF NOT EXISTS "Room" ("id" TEXT NOT NULL PRIMARY KEY, "number" TEXT NOT NULL, "name" TEXT NOT NULL, "type" "RoomType" NOT NULL, "pricePerNight" DOUBLE PRECISION NOT NULL, "floor" INTEGER NOT NULL, "capacity" INTEGER NOT NULL, "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE', "amenities" TEXT NOT NULL, "description" TEXT NOT NULL, "image" TEXT, "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Room_number_providerId_key" UNIQUE ("number", "providerId"));
CREATE TABLE IF NOT EXISTS "Guest" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "phone" TEXT NOT NULL, "email" TEXT NOT NULL DEFAULT '', "idNumber" TEXT NOT NULL DEFAULT '', "idType" TEXT NOT NULL DEFAULT '', "nationality" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '', "vip" BOOLEAN NOT NULL DEFAULT false, "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalStays" INTEGER NOT NULL DEFAULT 0, "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Reservation" ("id" TEXT NOT NULL PRIMARY KEY, "guestId" TEXT NOT NULL, "roomId" TEXT NOT NULL, "checkIn" TEXT NOT NULL, "checkOut" TEXT NOT NULL, "nights" INTEGER NOT NULL, "roomRate" DOUBLE PRECISION NOT NULL, "totalCost" DOUBLE PRECISION NOT NULL, "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "balance" DOUBLE PRECISION NOT NULL DEFAULT 0, "paymentStatus" "PaymentStatusType" NOT NULL DEFAULT 'PENDING', "paymentMethod" "PaymentMethodType", "status" "ReservationStatus" NOT NULL DEFAULT 'UPCOMING', "notes" TEXT NOT NULL DEFAULT '', "actualCheckIn" TIMESTAMP(3), "actualCheckOut" TIMESTAMP(3), "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "DaytimeService" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "price" DOUBLE PRECISION NOT NULL, "category" TEXT NOT NULL, "duration" TEXT NOT NULL DEFAULT '', "description" TEXT NOT NULL DEFAULT '', "active" BOOLEAN NOT NULL DEFAULT true, "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "DaytimeBooking" ("id" TEXT NOT NULL PRIMARY KEY, "serviceId" TEXT NOT NULL, "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL, "date" TEXT NOT NULL, "time" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1, "unitPrice" DOUBLE PRECISION NOT NULL, "totalCost" DOUBLE PRECISION NOT NULL, "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "paymentStatus" "PaymentStatusType" NOT NULL DEFAULT 'PENDING', "paymentMethod" "PaymentMethodType", "notes" TEXT NOT NULL DEFAULT '', "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Expense" ("id" TEXT NOT NULL PRIMARY KEY, "date" TEXT NOT NULL, "category" TEXT NOT NULL, "description" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "vendor" TEXT NOT NULL DEFAULT '', "paymentMethod" "PaymentMethodType" NOT NULL, "receiptNo" TEXT NOT NULL DEFAULT '', "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0, "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "ExpenseCategory" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameAm" TEXT NOT NULL, "color" TEXT NOT NULL, "icon" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Resource" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "category" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL, "minLevel" DOUBLE PRECISION NOT NULL DEFAULT 0, "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0, "supplier" TEXT NOT NULL DEFAULT '', "lastRestocked" TIMESTAMP(3), "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Payment" ("id" TEXT NOT NULL PRIMARY KEY, "reservationId" TEXT, "daytimeBookingId" TEXT, "amount" DOUBLE PRECISION NOT NULL, "method" "PaymentMethodType" NOT NULL, "referenceNo" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '', "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Notification" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "message" TEXT NOT NULL, "type" "NotificationType" NOT NULL DEFAULT 'INFO', "isRead" BOOLEAN NOT NULL DEFAULT false, "link" TEXT, "providerId" TEXT, "userId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "HousekeepingTask" ("id" TEXT NOT NULL PRIMARY KEY, "roomId" TEXT NOT NULL, "type" "HousekeepingTaskType" NOT NULL, "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'PENDING', "assignedTo" TEXT, "scheduledDate" TEXT NOT NULL, "notes" TEXT NOT NULL DEFAULT '', "completedAt" TIMESTAMP(3), "providerId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Review" ("id" TEXT NOT NULL PRIMARY KEY, "guestId" TEXT NOT NULL, "reservationId" TEXT NOT NULL, "rating" INTEGER NOT NULL, "comment" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "ActivityLog" ("id" TEXT NOT NULL PRIMARY KEY, "message" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'INFO', "providerId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Settings" ("id" TEXT NOT NULL PRIMARY KEY, "guestHouseName" TEXT NOT NULL DEFAULT 'Guest House', "ownerName" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '', "phone" TEXT NOT NULL DEFAULT '', "email" TEXT NOT NULL DEFAULT '', "currency" TEXT NOT NULL DEFAULT 'ETB', "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "language" TEXT NOT NULL DEFAULT 'en', "logo" TEXT, "checkInTime" TEXT NOT NULL DEFAULT '14:00', "checkOutTime" TEXT NOT NULL DEFAULT '12:00', "providerId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "SuspectedPerson" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "phone" TEXT NOT NULL DEFAULT '', "idNumber" TEXT NOT NULL DEFAULT '', "idType" TEXT NOT NULL DEFAULT '', "nationality" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '', "description" TEXT NOT NULL DEFAULT '', "severity" "SuspectSeverity" NOT NULL DEFAULT 'MEDIUM', "is_active" BOOLEAN NOT NULL DEFAULT true, "registeredBy" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "SuspectMatch" ("id" TEXT NOT NULL PRIMARY KEY, "suspectedPersonId" TEXT NOT NULL, "matchType" TEXT NOT NULL, "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL DEFAULT '', "guestIdNumber" TEXT NOT NULL DEFAULT '', "providerName" TEXT NOT NULL DEFAULT '', "providerId" TEXT NOT NULL DEFAULT '', "reservationId" TEXT, "daytimeBookingId" TEXT, "details" TEXT NOT NULL DEFAULT '', "isRead" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY, "officerName" TEXT NOT NULL DEFAULT '', "action" TEXT NOT NULL, "targetId" TEXT, "targetType" TEXT DEFAULT '', "details" TEXT, "ipAddress" TEXT DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Geofence" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "address" TEXT NOT NULL DEFAULT '', "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0, "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0, "radius" DOUBLE PRECISION NOT NULL DEFAULT 1000, "severity" TEXT NOT NULL DEFAULT 'HIGH', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "FrequentStayAlert" ("id" TEXT NOT NULL PRIMARY KEY, "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL DEFAULT '', "guestIdNumber" TEXT NOT NULL DEFAULT '', "providerNames" TEXT NOT NULL DEFAULT '[]', "stayCount" INTEGER NOT NULL DEFAULT 0, "avgDaysBetween" DOUBLE PRECISION NOT NULL DEFAULT 0, "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM', "isReviewed" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "Subscription" ("id" TEXT NOT NULL PRIMARY KEY, "providerId" TEXT NOT NULL, "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL, "cycle" "SubscriptionCycle" NOT NULL DEFAULT 'MONTHLY', "price" DOUBLE PRECISION NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Subscription_providerId_key" UNIQUE ("providerId"));
CREATE TABLE IF NOT EXISTS "SubscriptionPayment" ("id" TEXT NOT NULL PRIMARY KEY, "subscriptionId" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "cycle" "SubscriptionCycle" NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "markedBy" TEXT NOT NULL, "notes" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS "PoliceAlertConfig" ("id" TEXT NOT NULL PRIMARY KEY, "emailEnabled" BOOLEAN NOT NULL DEFAULT false, "emailRecipients" TEXT NOT NULL DEFAULT '[]', "smsEnabled" BOOLEAN NOT NULL DEFAULT false, "smsRecipients" TEXT NOT NULL DEFAULT '[]', "escalationDelayMins" INTEGER NOT NULL DEFAULT 60, "criticalImmediate" BOOLEAN NOT NULL DEFAULT true, "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);`;

let _initDone = false;

export async function ensureDatabase(): Promise<void> {
  if (_initDone) return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();

    // Check if User table exists
    const res = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') as ok`
    );
    if (res.rows[0]?.ok) {
      _initDone = true;
      return;
    }

    console.log("[init-db] Creating tables via pg...");
    await client.query(FULL_DDL);
    console.log("[init-db] Tables created.");

    // Seed SUPERUSER
    const hashed = await bcrypt.hash("Admin@2024", 12);
    await client.query(`
      INSERT INTO "User" ("id","username","password","name","role","permissions","policeRank","createdAt","updatedAt")
      SELECT 'su-admin-001','admin',$1,'System Administrator','SUPERUSER','[]','',NOW(),NOW()
      WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "username"='admin')
    `, [hashed]);
    console.log("[init-db] SUPERUSER seeded.");

    // Seed PoliceAlertConfig
    await client.query(`
      INSERT INTO "PoliceAlertConfig" ("id","createdAt","updatedAt")
      SELECT 'default-alert-config',NOW(),NOW()
      WHERE NOT EXISTS (SELECT 1 FROM "PoliceAlertConfig" WHERE "id"='default-alert-config')
    `);

    _initDone = true;
  } finally {
    await client.end().catch(() => {});
  }
}