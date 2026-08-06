import pg from "pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const { Client } = pg;

// ─── Enum types ────────────────────────────────────────────────────────────
const ENUMS_SQL = `
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
`;

// ─── Table creation ────────────────────────────────────────────────────────
const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "Provider" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'GUEST_HOUSE',
  "licenseNo" TEXT NOT NULL DEFAULT '',
  "licenseFile" TEXT NOT NULL DEFAULT '',
  "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING',
  "latitude" DOUBLE PRECISION NOT NULL DEFAULT 9.02,
  "longitude" DOUBLE PRECISION NOT NULL DEFAULT 38.75,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT NOT NULL DEFAULT '',
  "suspensionReason" TEXT NOT NULL DEFAULT '',
  "suspendedAt" TIMESTAMP(3),
  "suspendedBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'STAFF',
  "name" TEXT NOT NULL,
  "email" TEXT DEFAULT '',
  "phone" TEXT DEFAULT '',
  "permissions" TEXT NOT NULL DEFAULT '["reservations","guests"]',
  "policeRank" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLogin" TIMESTAMP(3),
  "providerId" TEXT,
  "createdBy" TEXT,
  "gender" TEXT NOT NULL DEFAULT '',
  "age" TEXT NOT NULL DEFAULT '',
  "dateOfBirth" TEXT NOT NULL DEFAULT '',
  "badgeNumber" TEXT NOT NULL DEFAULT '',
  "stationName" TEXT NOT NULL DEFAULT '',
  "joinDate" TEXT NOT NULL DEFAULT '',
  "photoUrl" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_username_key" UNIQUE ("username")
);
DO $$ BEGIN CREATE INDEX "User_createdBy_idx" ON "User"("createdBy"); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "Room" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "number" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "RoomType" NOT NULL,
  "pricePerNight" DOUBLE PRECISION NOT NULL,
  "floor" INTEGER NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "amenities" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "image" TEXT,
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_number_providerId_key" UNIQUE ("number", "providerId")
);
CREATE TABLE IF NOT EXISTS "Guest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "idNumber" TEXT NOT NULL DEFAULT '',
  "idType" TEXT NOT NULL DEFAULT '',
  "nationality" TEXT NOT NULL DEFAULT '',
  "gender" TEXT NOT NULL DEFAULT '',
  "age" TEXT NOT NULL DEFAULT '',
  "dateOfBirth" TEXT NOT NULL DEFAULT '',
  "occupation" TEXT NOT NULL DEFAULT '',
  "photoUrl" TEXT NOT NULL DEFAULT '',
  "region" TEXT NOT NULL DEFAULT '',
  "zone" TEXT NOT NULL DEFAULT '',
  "woreda" TEXT NOT NULL DEFAULT '',
  "kebele" TEXT NOT NULL DEFAULT '',
  "houseNumber" TEXT NOT NULL DEFAULT '',
  "streetName" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "vip" BOOLEAN NOT NULL DEFAULT false,
  "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalStays" INTEGER NOT NULL DEFAULT 0,
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Reservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guestId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "checkIn" TEXT NOT NULL,
  "checkOut" TEXT NOT NULL,
  "nights" INTEGER NOT NULL,
  "roomRate" DOUBLE PRECISION NOT NULL,
  "totalCost" DOUBLE PRECISION NOT NULL,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentStatus" "PaymentStatusType" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "PaymentMethodType",
  "status" "ReservationStatus" NOT NULL DEFAULT 'UPCOMING',
  "notes" TEXT NOT NULL DEFAULT '',
  "actualCheckIn" TIMESTAMP(3),
  "actualCheckOut" TIMESTAMP(3),
  "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "DaytimeService" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL,
  "duration" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "DaytimeBooking" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serviceId" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestPhone" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "time" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "totalCost" DOUBLE PRECISION NOT NULL,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentStatus" "PaymentStatusType" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "PaymentMethodType",
  "notes" TEXT NOT NULL DEFAULT '',
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "vendor" TEXT NOT NULL DEFAULT '',
  "paymentMethod" "PaymentMethodType" NOT NULL,
  "receiptNo" TEXT NOT NULL DEFAULT '',
  "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "nameAm" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "icon" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Resource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "minLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "supplier" TEXT NOT NULL DEFAULT '',
  "lastRestocked" TIMESTAMP(3),
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reservationId" TEXT,
  "daytimeBookingId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" "PaymentMethodType" NOT NULL,
  "referenceNo" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'INFO',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "link" TEXT,
  "providerId" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "HousekeepingTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "type" "HousekeepingTaskType" NOT NULL,
  "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'PENDING',
  "assignedTo" TEXT,
  "scheduledDate" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "completedAt" TIMESTAMP(3),
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guestId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'INFO',
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guestHouseName" TEXT NOT NULL DEFAULT 'Guest House',
  "ownerName" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "currency" TEXT NOT NULL DEFAULT 'ETB',
  "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "language" TEXT NOT NULL DEFAULT 'en',
  "logo" TEXT,
  "checkInTime" TEXT NOT NULL DEFAULT '14:00',
  "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
  "configJson" JSONB,
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
  "severity" "SuspectSeverity" NOT NULL DEFAULT 'MEDIUM',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "registeredBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL DEFAULT '',
  "userName" TEXT NOT NULL DEFAULT '',
  "userRole" TEXT NOT NULL DEFAULT '',
  "providerName" TEXT NOT NULL DEFAULT '',
  "officerName" TEXT NOT NULL DEFAULT '',
  "action" TEXT NOT NULL,
  "targetId" TEXT,
  "targetType" TEXT DEFAULT '',
  "details" TEXT,
  "ipAddress" TEXT DEFAULT '',
  "userAgent" TEXT DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AnomalyRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "riskScore" INTEGER NOT NULL DEFAULT 0,
  "guestName" TEXT NOT NULL DEFAULT '',
  "guestPhone" TEXT NOT NULL DEFAULT '',
  "guestIdNumber" TEXT NOT NULL DEFAULT '',
  "providerId" TEXT NOT NULL DEFAULT '',
  "providerName" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "metadata" TEXT NOT NULL DEFAULT '',
  "isReviewed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Geofence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL DEFAULT '',
  "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "radius" DOUBLE PRECISION NOT NULL DEFAULT 1000,
  "severity" TEXT NOT NULL DEFAULT 'HIGH',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "FrequentStayAlert" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guestName" TEXT NOT NULL,
  "guestPhone" TEXT NOT NULL DEFAULT '',
  "guestIdNumber" TEXT NOT NULL DEFAULT '',
  "providerNames" TEXT NOT NULL DEFAULT '[]',
  "stayCount" INTEGER NOT NULL DEFAULT 0,
  "avgDaysBetween" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
  "isReviewed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "providerId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "cycle" "SubscriptionCycle" NOT NULL DEFAULT 'MONTHLY',
  "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_providerId_key" UNIQUE ("providerId")
);
CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "cycle" "SubscriptionCycle" NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "markedBy" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "cycle" "SubscriptionCycle" NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "PoliceAlertConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "emailRecipients" TEXT NOT NULL DEFAULT '[]',
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsRecipients" TEXT NOT NULL DEFAULT '[]',
  "escalationDelayMins" INTEGER NOT NULL DEFAULT 60,
  "criticalImmediate" BOOLEAN NOT NULL DEFAULT true,
  "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

// ─── Foreign Keys ──────────────────────────────────────────────────────────
const FKS_SQL = `
DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Room" ADD CONSTRAINT "Room_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Guest" ADD CONSTRAINT "Guest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DaytimeService" ADD CONSTRAINT "DaytimeService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DaytimeBooking" ADD CONSTRAINT "DaytimeBooking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DaytimeBooking" ADD CONSTRAINT "DaytimeBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "DaytimeService"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Resource" ADD CONSTRAINT "Resource_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_daytimeBookingId_fkey" FOREIGN KEY ("daytimeBookingId") REFERENCES "DaytimeBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Notification" ADD CONSTRAINT "Notification_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Review" ADD CONSTRAINT "Review_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Review" ADD CONSTRAINT "Review_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Settings" ADD COLUMN "configJson" JSONB; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Settings" ADD CONSTRAINT "Settings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "SuspectMatch" ADD CONSTRAINT "SuspectMatch_suspectedPersonId_fkey" FOREIGN KEY ("suspectedPersonId") REFERENCES "SuspectedPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
`;

// ─── Migrations: Add new columns to existing tables ────────────────
const MIGRATIONS_SQL = `
-- Add email, phone, isActive, lastLogin, permissions, policeRank to User table if missing
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "email" TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "phone" TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT '["reservations","guests"]';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "policeRank" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "lastLogin" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "createdBy" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "region" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "zone" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "woreda" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "kebele" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "houseNumber" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "streetName" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Subscription" ADD COLUMN "planId" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Provider" ADD COLUMN "suspensionReason" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Provider" ADD COLUMN "suspendedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Provider" ADD COLUMN "suspendedBy" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "gender" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "age" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "dateOfBirth" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "occupation" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "lastSeenLocation" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "photoUrl" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "caseNumber" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "SuspectedPerson" ADD COLUMN "wantedDate" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "gender" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "age" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "dateOfBirth" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "occupation" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "Guest" ADD COLUMN "photoUrl" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "gender" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "age" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "dateOfBirth" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "badgeNumber" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "stationName" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "joinDate" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "User" ADD COLUMN "photoUrl" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
-- AuditLog missing columns (added for super user audit log feature)
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD COLUMN "userName" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD COLUMN "userRole" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD COLUMN "providerName" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
`;

// ─── Indexes ───────────────────────────────────────────────────────────────
const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS "Provider_status_idx" ON "Provider" ("status");
CREATE INDEX IF NOT EXISTS "Provider_createdAt_idx" ON "Provider" ("createdAt");
CREATE INDEX IF NOT EXISTS "User_providerId_idx" ON "User" ("providerId");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User" ("role");
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User" ("isActive");
CREATE INDEX IF NOT EXISTS "Room_providerId_idx" ON "Room" ("providerId");
CREATE INDEX IF NOT EXISTS "Room_status_idx" ON "Room" ("status");
CREATE INDEX IF NOT EXISTS "Guest_providerId_idx" ON "Guest" ("providerId");
CREATE INDEX IF NOT EXISTS "Guest_phone_idx" ON "Guest" ("phone");
CREATE INDEX IF NOT EXISTS "Guest_idNumber_idx" ON "Guest" ("idNumber");
CREATE INDEX IF NOT EXISTS "Guest_email_idx" ON "Guest" ("email");
CREATE INDEX IF NOT EXISTS "Guest_createdAt_idx" ON "Guest" ("createdAt");
CREATE INDEX IF NOT EXISTS "Guest_name_idx" ON "Guest" ("name");
CREATE INDEX IF NOT EXISTS "Guest_region_idx" ON "Guest" ("region");
CREATE INDEX IF NOT EXISTS "Guest_zone_idx" ON "Guest" ("zone");
CREATE INDEX IF NOT EXISTS "Guest_woreda_idx" ON "Guest" ("woreda");
CREATE INDEX IF NOT EXISTS "Reservation_providerId_idx" ON "Reservation" ("providerId");
CREATE INDEX IF NOT EXISTS "Reservation_guestId_idx" ON "Reservation" ("guestId");
CREATE INDEX IF NOT EXISTS "Reservation_roomId_idx" ON "Reservation" ("roomId");
CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation" ("status");
CREATE INDEX IF NOT EXISTS "Reservation_createdAt_idx" ON "Reservation" ("createdAt");
CREATE INDEX IF NOT EXISTS "Reservation_checkIn_idx" ON "Reservation" ("checkIn");
CREATE INDEX IF NOT EXISTS "DaytimeService_providerId_idx" ON "DaytimeService" ("providerId");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_providerId_idx" ON "DaytimeBooking" ("providerId");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_serviceId_idx" ON "DaytimeBooking" ("serviceId");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_guestPhone_idx" ON "DaytimeBooking" ("guestPhone");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_date_idx" ON "DaytimeBooking" ("date");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_createdAt_idx" ON "DaytimeBooking" ("createdAt");
CREATE INDEX IF NOT EXISTS "Expense_providerId_idx" ON "Expense" ("providerId");
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense" ("date");
CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense" ("category");
CREATE INDEX IF NOT EXISTS "Resource_providerId_idx" ON "Resource" ("providerId");
CREATE INDEX IF NOT EXISTS "Resource_category_idx" ON "Resource" ("category");
CREATE INDEX IF NOT EXISTS "Payment_providerId_idx" ON "Payment" ("providerId");
CREATE INDEX IF NOT EXISTS "Payment_reservationId_idx" ON "Payment" ("reservationId");
CREATE INDEX IF NOT EXISTS "Payment_daytimeBookingId_idx" ON "Payment" ("daytimeBookingId");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment" ("createdAt");
CREATE INDEX IF NOT EXISTS "Notification_providerId_idx" ON "Notification" ("providerId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification" ("userId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification" ("isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification" ("createdAt");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_providerId_idx" ON "HousekeepingTask" ("providerId");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_roomId_idx" ON "HousekeepingTask" ("roomId");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_status_idx" ON "HousekeepingTask" ("status");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_scheduledDate_idx" ON "HousekeepingTask" ("scheduledDate");
CREATE INDEX IF NOT EXISTS "Review_guestId_idx" ON "Review" ("guestId");
CREATE INDEX IF NOT EXISTS "Review_reservationId_idx" ON "Review" ("reservationId");
CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review" ("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_providerId_idx" ON "ActivityLog" ("providerId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "Settings_providerId_idx" ON "Settings" ("providerId");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_name_idx" ON "SuspectedPerson" ("name");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_phone_idx" ON "SuspectedPerson" ("phone");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_idNumber_idx" ON "SuspectedPerson" ("idNumber");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_severity_idx" ON "SuspectedPerson" ("severity");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_is_active_idx" ON "SuspectedPerson" ("is_active");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_caseNumber_idx" ON "SuspectedPerson" ("caseNumber");
CREATE INDEX IF NOT EXISTS "SuspectMatch_suspectedPersonId_idx" ON "SuspectMatch" ("suspectedPersonId");
CREATE INDEX IF NOT EXISTS "SuspectMatch_isRead_idx" ON "SuspectMatch" ("isRead");
CREATE INDEX IF NOT EXISTS "SuspectMatch_createdAt_idx" ON "SuspectMatch" ("createdAt");
CREATE INDEX IF NOT EXISTS "SuspectMatch_guestPhone_idx" ON "SuspectMatch" ("guestPhone");
CREATE INDEX IF NOT EXISTS "SuspectMatch_guestIdNumber_idx" ON "SuspectMatch" ("guestIdNumber");
CREATE INDEX IF NOT EXISTS "SuspectMatch_providerId_idx" ON "SuspectMatch" ("providerId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog" ("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_officerName_idx" ON "AuditLog" ("officerName");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog" ("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_userRole_idx" ON "AuditLog" ("userRole");
CREATE INDEX IF NOT EXISTS "AuditLog_userName_idx" ON "AuditLog" ("userName");
CREATE INDEX IF NOT EXISTS "AnomalyRecord_type_idx" ON "AnomalyRecord" ("type");
CREATE INDEX IF NOT EXISTS "AnomalyRecord_severity_idx" ON "AnomalyRecord" ("severity");
CREATE INDEX IF NOT EXISTS "AnomalyRecord_createdAt_idx" ON "AnomalyRecord" ("createdAt");
CREATE INDEX IF NOT EXISTS "AnomalyRecord_isReviewed_idx" ON "AnomalyRecord" ("isReviewed");
CREATE INDEX IF NOT EXISTS "AnomalyRecord_providerId_idx" ON "AnomalyRecord" ("providerId");
CREATE INDEX IF NOT EXISTS "AnomalyRecord_riskScore_idx" ON "AnomalyRecord" ("riskScore");
CREATE INDEX IF NOT EXISTS "Geofence_isActive_idx" ON "Geofence" ("isActive");
CREATE INDEX IF NOT EXISTS "Geofence_severity_idx" ON "Geofence" ("severity");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_createdAt_idx" ON "FrequentStayAlert" ("createdAt");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_isReviewed_idx" ON "FrequentStayAlert" ("isReviewed");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_riskLevel_idx" ON "FrequentStayAlert" ("riskLevel");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_guestPhone_idx" ON "FrequentStayAlert" ("guestPhone");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_guestIdNumber_idx" ON "FrequentStayAlert" ("guestIdNumber");
CREATE INDEX IF NOT EXISTS "Subscription_endDate_idx" ON "Subscription" ("endDate");
CREATE INDEX IF NOT EXISTS "Subscription_planId_idx" ON "Subscription" ("planId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment" ("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_createdAt_idx" ON "SubscriptionPayment" ("createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_cycle_idx" ON "SubscriptionPlan" ("cycle");
CREATE INDEX IF NOT EXISTS "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan" ("isActive");
`;

let _initDone = false;
let _migrationsRan = false;
let _initPromise: Promise<void> | null = null;

/** Execute SQL via raw pg Client */
async function execViaPg(sql: string, params?: unknown[]): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL! });
  try {
    await client.connect();
    await client.query(sql, params);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Execute DDL via Prisma $executeRawUnsafe — splits multi-statement SQL
 *  because Prisma's driver does NOT support multiple statements per call. */
async function execViaPrisma(sql: string): Promise<void> {
  // Split on `DO $$` blocks and standalone statements
  // Each `DO $$ ... END $$;` is one executable unit
  const statements = sql
    .split(/(?=DO \$\$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // If no DO blocks found, split by semicolons (for CREATE INDEX etc.)
  const parts = statements.length > 1
    ? statements
    : sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

  const prisma = new PrismaClient({
    log: ["warn", "error"],
  });
  try {
    for (const part of parts) {
      const stmt = part.endsWith(';') ? part : part + ';';
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        // Individual statement might fail (e.g. duplicate_object) — log but continue
        console.error("[execViaPrisma] Statement failed (continuing):", stmt.slice(0, 80), err instanceof Error ? err.message : String(err));
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

/**
 * Run only MIGRATIONS_SQL + INDEXES_SQL without full init.
 * Used as a background check when _initDone is already true.
 */
async function runMigrationsOnly(): Promise<void> {
  console.log("[init-db] Running idempotent migrations on existing DB...");
  try {
    await execViaPrisma(MIGRATIONS_SQL);
    console.log("[init-db] Background migrations applied.");
  } catch (err) {
    throw err;
  }
  try {
    await execViaPrisma(INDEXES_SQL);
  } catch {
    // Indexes are best-effort
  }
}

export async function ensureDatabase(): Promise<void> {
  if (_initDone) {
    // Always run migrations synchronously to ensure columns exist
    // before any query executes. Migrations are idempotent.
    if (!_migrationsRan) {
      _migrationsRan = true;
      await runMigrationsOnly();
    }
    return;
  }
  if (_initPromise) return _initPromise;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  _initPromise = (async () => {
    console.log("[init-db] Starting database initialization...");

    let usePg = true;
    let pgError: unknown = null;

    // Strategy 1: Try using pg Client directly
    try {
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      console.log("[init-db] pg Client connected successfully.");

      // Check if User table already exists
      const res = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') as ok`
      );
      const tableExists = res.rows[0]?.ok === true;
      console.log("[init-db] User table exists:", tableExists);

      if (tableExists) {
        console.log("[init-db] Tables already exist, running migrations to add any missing columns...");
        try {
          await client.query(MIGRATIONS_SQL);
          console.log("[init-db] Migrations applied to existing tables.");
          await client.query(INDEXES_SQL);
          console.log("[init-db] Indexes verified.");
        } catch (migrateErr) {
          console.error("[init-db] Migration on existing tables failed:", migrateErr instanceof Error ? migrateErr.message : String(migrateErr));
          // Don't throw — the tables exist, migrations are best-effort
        }
        await client.end().catch(() => {});
        _initDone = true;
        return;
      }

      // Create enums
      console.log("[init-db] Creating enum types...");
      await client.query(ENUMS_SQL);

      // Create tables
      console.log("[init-db] Creating tables...");
      await client.query(TABLES_SQL);

      // Verify User table was created
      const verify = await client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') as ok`
      );
      if (!verify.rows[0]?.ok) {
        throw new Error("DDL executed but User table still not found!");
      }
      console.log("[init-db] Tables verified.");

      // Create foreign keys
      console.log("[init-db] Creating foreign keys...");
      await client.query(FKS_SQL);

      // Run migrations (add new columns to existing tables)
      console.log("[init-db] Running migrations...");
      await client.query(MIGRATIONS_SQL);

      // Create indexes
      console.log("[init-db] Creating indexes...");
      await client.query(INDEXES_SQL);

      // Seed SUPERUSER
      console.log("[init-db] Seeding SUPERUSER...");
      const hashed = await bcrypt.hash("Admin@2024", 12);
      await client.query(
        `INSERT INTO "User" ("id","username","password","name","role","permissions","policeRank","createdAt","updatedAt")
         SELECT 'su-admin-001','admin',$1,'System Administrator','SUPERUSER','[]','',NOW(),NOW()
         WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "username"='admin')`,
        [hashed]
      );

      // Seed PoliceAlertConfig
      await client.query(
        `INSERT INTO "PoliceAlertConfig" ("id","createdAt","updatedAt")
         SELECT 'default-alert-config',NOW(),NOW()
         WHERE NOT EXISTS (SELECT 1 FROM "PoliceAlertConfig" WHERE "id"='default-alert-config')`
      );

      // Seed default SubscriptionPlans
      await client.query(`
        INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
        SELECT 'plan-monthly-001','Monthly','MONTHLY',500,true,NOW(),NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-monthly-001');
        INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
        SELECT 'plan-quarterly-001','Quarterly','QUARTERLY',1400,true,NOW(),NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-quarterly-001');
        INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
        SELECT 'plan-semi-annual-001','Semi-Annual','SEMI_ANNUAL',2600,true,NOW(),NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-semi-annual-001');
        INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
        SELECT 'plan-yearly-001','Annual','YEARLY',4800,true,NOW(),NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-yearly-001');
      `);

      console.log("[init-db] Database initialization complete via pg.");
      await client.end().catch(() => {});
      _initDone = true;
      return;
    } catch (err) {
      pgError = err;
      console.error("[init-db] pg approach failed:", err instanceof Error ? err.message : String(err));
      usePg = false;
    }

    // Strategy 2: Fallback — use Prisma $executeRawUnsafe
    console.log("[init-db] Falling back to Prisma $executeRawUnsafe...");
    try {
      // First check if tables exist using Prisma raw query
      const prisma = new PrismaClient({ log: ["warn", "error"] });
      try {
        const res: Array<{ ok: boolean }> = await prisma.$queryRawUnsafe(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') as ok`
        );
        if (res[0]?.ok) {
          console.log("[init-db] Tables already exist (verified via Prisma), running migrations...");
          try {
            await execViaPrisma(MIGRATIONS_SQL);
            console.log("[init-db] Migrations applied via Prisma.");
            await execViaPrisma(INDEXES_SQL);
            console.log("[init-db] Indexes verified via Prisma.");
          } catch (migrateErr) {
            console.error("[init-db] Prisma migration on existing tables failed:", migrateErr instanceof Error ? migrateErr.message : String(migrateErr));
          }
          _initDone = true;
          return;
        }
      } catch {
        // Table might not exist, which is expected
        console.log("[init-db] Tables do not exist yet, creating via Prisma...");
      } finally {
        await prisma.$disconnect().catch(() => {});
      }

      // Execute DDL via Prisma (split into parts to avoid query size issues)
      await execViaPrisma(ENUMS_SQL);
      console.log("[init-db] Enums created via Prisma.");

      await execViaPrisma(TABLES_SQL);
      console.log("[init-db] Tables created via Prisma.");

      await execViaPrisma(FKS_SQL);
      console.log("[init-db] Foreign keys created via Prisma.");

      await execViaPrisma(MIGRATIONS_SQL);
      console.log("[init-db] Migrations ran via Prisma.");

      await execViaPrisma(INDEXES_SQL);
      console.log("[init-db] Indexes created via Prisma.");

      // Seed SUPERUSER via Prisma
      const prisma2 = new PrismaClient({ log: ["warn", "error"] });
      try {
        const hashed = await bcrypt.hash("Admin@2024", 12);
        await prisma2.$executeRawUnsafe(
          `INSERT INTO "User" ("id","username","password","name","role","permissions","policeRank","createdAt","updatedAt")
           SELECT 'su-admin-001','admin',$1,'System Administrator','SUPERUSER','[]','',NOW(),NOW()
           WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "username"='admin')`,
          hashed
        );
        await prisma2.$executeRawUnsafe(
          `INSERT INTO "PoliceAlertConfig" ("id","createdAt","updatedAt")
           SELECT 'default-alert-config',NOW(),NOW()
           WHERE NOT EXISTS (SELECT 1 FROM "PoliceAlertConfig" WHERE "id"='default-alert-config')`
        );
        // Seed default SubscriptionPlans
        await prisma2.$executeRawUnsafe(
          `INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
           SELECT 'plan-monthly-001','Monthly','MONTHLY',500,true,NOW(),NOW()
           WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-monthly-001')`
        );
        await prisma2.$executeRawUnsafe(
          `INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
           SELECT 'plan-quarterly-001','Quarterly','QUARTERLY',1400,true,NOW(),NOW()
           WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-quarterly-001')`
        );
        await prisma2.$executeRawUnsafe(
          `INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
           SELECT 'plan-semi-annual-001','Semi-Annual','SEMI_ANNUAL',2600,true,NOW(),NOW()
           WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-semi-annual-001')`
        );
        await prisma2.$executeRawUnsafe(
          `INSERT INTO "SubscriptionPlan" ("id","name","cycle","price","isActive","createdAt","updatedAt")
           SELECT 'plan-yearly-001','Annual','YEARLY',4800,true,NOW(),NOW()
           WHERE NOT EXISTS (SELECT 1 FROM "SubscriptionPlan" WHERE "id"='plan-yearly-001')`
        );
        console.log("[init-db] SUPERUSER and plans seeded via Prisma.");
      } finally {
        await prisma2.$disconnect().catch(() => {});
      }

      console.log("[init-db] Database initialization complete via Prisma fallback.");
      _initDone = true;
    } catch (prismaErr) {
      console.error("[init-db] Prisma fallback also failed:", prismaErr instanceof Error ? prismaErr.message : String(prismaErr));
      _initDone = false;
      _initPromise = null; // Allow retry
      throw new Error(
        `Database initialization failed. pg error: ${pgError instanceof Error ? pgError.message : String(pgError)} | Prisma error: ${prismaErr instanceof Error ? prismaErr.message : String(prismaErr)}`
      );
    }
  })();

  return _initPromise;
}

/**
 * Force-run just the migrations + indexes on the live database.
 * Useful after deploying schema changes to add new columns without full re-init.
 * All migrations use EXCEPTION WHEN duplicate_column so they are safe to re-run.
 */
export async function forceMigrate(): Promise<void> {
  console.log("[forceMigrate] Running migrations on existing database...");
  try {
    await execViaPrisma(MIGRATIONS_SQL);
    console.log("[forceMigrate] Migrations applied.");
  } catch (err) {
    console.error("[forceMigrate] Migration failed:", err instanceof Error ? err.message : String(err));
    throw err;
  }
  try {
    await execViaPrisma(INDEXES_SQL);
    console.log("[forceMigrate] Indexes verified.");
  } catch (err) {
    console.error("[forceMigrate] Index creation failed:", err instanceof Error ? err.message : String(err));
    // Don't throw — indexes are best-effort
  }
  // Reset init flag so next ensureDatabase() will do a full check
  _initDone = false;
  _initPromise = null;
}
