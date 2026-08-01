import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type PrismaClientInstance = PrismaClient & { $disconnect: () => Promise<void> };

let _db: PrismaClientInstance | null = null;
let _initPromise: Promise<void> | null = null;

// ── Full PostgreSQL DDL ──
const SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS "Provider" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL, "ownerName" TEXT NOT NULL, "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'GUEST_HOUSE',
  "licenseNo" TEXT NOT NULL DEFAULT '', "licenseFile" TEXT NOT NULL DEFAULT '',
  "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING',
  "latitude" DOUBLE PRECISION NOT NULL DEFAULT 9.02,
  "longitude" DOUBLE PRECISION NOT NULL DEFAULT 38.75,
  "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
  "rejectionReason" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL, "password" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'STAFF',
  "name" TEXT NOT NULL,
  "permissions" TEXT NOT NULL DEFAULT '["reservations","guests"]',
  "policeRank" TEXT NOT NULL DEFAULT '',
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_username_key" UNIQUE ("username")
);
CREATE TABLE IF NOT EXISTS "Room" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "number" TEXT NOT NULL, "name" TEXT NOT NULL,
  "type" "RoomType" NOT NULL,
  "pricePerNight" DOUBLE PRECISION NOT NULL,
  "floor" INTEGER NOT NULL, "capacity" INTEGER NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "amenities" TEXT NOT NULL, "description" TEXT NOT NULL,
  "image" TEXT, "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_number_providerId_key" UNIQUE ("number", "providerId")
);
CREATE TABLE IF NOT EXISTS "Guest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL, "phone" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '', "idNumber" TEXT NOT NULL DEFAULT '',
  "idType" TEXT NOT NULL DEFAULT '', "nationality" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '', "notes" TEXT NOT NULL DEFAULT '',
  "vip" BOOLEAN NOT NULL DEFAULT false,
  "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalStays" INTEGER NOT NULL DEFAULT 0,
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Reservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guestId" TEXT NOT NULL, "roomId" TEXT NOT NULL,
  "checkIn" TEXT NOT NULL, "checkOut" TEXT NOT NULL,
  "nights" INTEGER NOT NULL, "roomRate" DOUBLE PRECISION NOT NULL,
  "totalCost" DOUBLE PRECISION NOT NULL,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentStatus" "PaymentStatusType" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "PaymentMethodType",
  "status" "ReservationStatus" NOT NULL DEFAULT 'UPCOMING',
  "notes" TEXT NOT NULL DEFAULT '',
  "actualCheckIn" TIMESTAMP(3), "actualCheckOut" TIMESTAMP(3),
  "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "DaytimeService" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL, "price" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL, "duration" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true, "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "DaytimeBooking" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "serviceId" TEXT NOT NULL,
  "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL,
  "date" TEXT NOT NULL, "time" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL, "totalCost" DOUBLE PRECISION NOT NULL,
  "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentStatus" "PaymentStatusType" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "PaymentMethodType",
  "notes" TEXT NOT NULL DEFAULT '', "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TEXT NOT NULL, "category" TEXT NOT NULL,
  "description" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL,
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
  "name" TEXT NOT NULL, "nameAm" TEXT NOT NULL,
  "color" TEXT NOT NULL, "icon" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Resource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL, "category" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL, "unit" TEXT NOT NULL,
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
  "reservationId" TEXT, "daytimeBookingId" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" "PaymentMethodType" NOT NULL,
  "referenceNo" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '', "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL, "message" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'INFO',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "link" TEXT, "providerId" TEXT, "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "HousekeepingTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roomId" TEXT NOT NULL,
  "type" "HousekeepingTaskType" NOT NULL,
  "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'PENDING',
  "assignedTo" TEXT, "scheduledDate" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "completedAt" TIMESTAMP(3), "providerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guestId" TEXT NOT NULL, "reservationId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL, "comment" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "message" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'INFO',
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
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "SuspectedPerson" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL, "phone" TEXT NOT NULL DEFAULT '',
  "idNumber" TEXT NOT NULL DEFAULT '', "idType" TEXT NOT NULL DEFAULT '',
  "nationality" TEXT NOT NULL DEFAULT '',
  "address" TEXT NOT NULL DEFAULT '',
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
  "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL DEFAULT '',
  "guestIdNumber" TEXT NOT NULL DEFAULT '',
  "providerName" TEXT NOT NULL DEFAULT '',
  "providerId" TEXT NOT NULL DEFAULT '',
  "reservationId" TEXT, "daytimeBookingId" TEXT,
  "details" TEXT NOT NULL DEFAULT '',
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "officerName" TEXT NOT NULL DEFAULT '',
  "action" TEXT NOT NULL, "targetId" TEXT,
  "targetType" TEXT DEFAULT '', "details" TEXT,
  "ipAddress" TEXT DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Geofence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL, "address" TEXT NOT NULL DEFAULT '',
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
  "guestName" TEXT NOT NULL, "guestPhone" TEXT NOT NULL DEFAULT '',
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
  "startDate" TIMESTAMP(3) NOT NULL, "endDate" TIMESTAMP(3) NOT NULL,
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

const POST_INIT_SQL = `
DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Room" ADD CONSTRAINT "Room_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Guest" ADD CONSTRAINT "Guest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DaytimeService" ADD CONSTRAINT "DaytimeService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DaytimeBooking" ADD CONSTRAINT "DaytimeBooking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "DaytimeBooking" ADD CONSTRAINT "DaytimeBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "DaytimeService"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Expense" ADD CONSTRAINT "Expense_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Resource" ADD CONSTRAINT "Resource_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Payment" ADD CONSTRAINT "Payment_daytimeBookingId_fkey" FOREIGN KEY ("daytimeBookingId") REFERENCES "DaytimeBooking"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Notification" ADD CONSTRAINT "Notification_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Review" ADD CONSTRAINT "Review_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Review" ADD CONSTRAINT "Review_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Settings" ADD CONSTRAINT "Settings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "SuspectMatch" ADD CONSTRAINT "SuspectMatch_suspectedPersonId_fkey" FOREIGN KEY ("suspectedPersonId") REFERENCES "SuspectedPerson"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE INDEX IF NOT EXISTS "Provider_status_idx" ON "Provider"("status");
CREATE INDEX IF NOT EXISTS "Provider_createdAt_idx" ON "Provider"("createdAt");
CREATE INDEX IF NOT EXISTS "User_providerId_idx" ON "User"("providerId");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "Room_providerId_idx" ON "Room"("providerId");
CREATE INDEX IF NOT EXISTS "Room_status_idx" ON "Room"("status");
CREATE INDEX IF NOT EXISTS "Guest_providerId_idx" ON "Guest"("providerId");
CREATE INDEX IF NOT EXISTS "Guest_phone_idx" ON "Guest"("phone");
CREATE INDEX IF NOT EXISTS "Guest_idNumber_idx" ON "Guest"("idNumber");
CREATE INDEX IF NOT EXISTS "Guest_email_idx" ON "Guest"("email");
CREATE INDEX IF NOT EXISTS "Guest_createdAt_idx" ON "Guest"("createdAt");
CREATE INDEX IF NOT EXISTS "Guest_name_idx" ON "Guest"("name");
CREATE INDEX IF NOT EXISTS "Reservation_providerId_idx" ON "Reservation"("providerId");
CREATE INDEX IF NOT EXISTS "Reservation_guestId_idx" ON "Reservation"("guestId");
CREATE INDEX IF NOT EXISTS "Reservation_roomId_idx" ON "Reservation"("roomId");
CREATE INDEX IF NOT EXISTS "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX IF NOT EXISTS "Reservation_createdAt_idx" ON "Reservation"("createdAt");
CREATE INDEX IF NOT EXISTS "Reservation_checkIn_idx" ON "Reservation"("checkIn");
CREATE INDEX IF NOT EXISTS "DaytimeService_providerId_idx" ON "DaytimeService"("providerId");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_providerId_idx" ON "DaytimeBooking"("providerId");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_serviceId_idx" ON "DaytimeBooking"("serviceId");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_guestPhone_idx" ON "DaytimeBooking"("guestPhone");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_date_idx" ON "DaytimeBooking"("date");
CREATE INDEX IF NOT EXISTS "DaytimeBooking_createdAt_idx" ON "DaytimeBooking"("createdAt");
CREATE INDEX IF NOT EXISTS "Expense_providerId_idx" ON "Expense"("providerId");
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date");
CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense"("category");
CREATE INDEX IF NOT EXISTS "Resource_providerId_idx" ON "Resource"("providerId");
CREATE INDEX IF NOT EXISTS "Resource_category_idx" ON "Resource"("category");
CREATE INDEX IF NOT EXISTS "Payment_providerId_idx" ON "Payment"("providerId");
CREATE INDEX IF NOT EXISTS "Payment_reservationId_idx" ON "Payment"("reservationId");
CREATE INDEX IF NOT EXISTS "Payment_daytimeBookingId_idx" ON "Payment"("daytimeBookingId");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX IF NOT EXISTS "Notification_providerId_idx" ON "Notification"("providerId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_providerId_idx" ON "HousekeepingTask"("providerId");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_roomId_idx" ON "HousekeepingTask"("roomId");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_status_idx" ON "HousekeepingTask"("status");
CREATE INDEX IF NOT EXISTS "HousekeepingTask_scheduledDate_idx" ON "HousekeepingTask"("scheduledDate");
CREATE INDEX IF NOT EXISTS "Review_guestId_idx" ON "Review"("guestId");
CREATE INDEX IF NOT EXISTS "Review_reservationId_idx" ON "Review"("reservationId");
CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_providerId_idx" ON "ActivityLog"("providerId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "Settings_providerId_idx" ON "Settings"("providerId");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_name_idx" ON "SuspectedPerson"("name");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_phone_idx" ON "SuspectedPerson"("phone");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_idNumber_idx" ON "SuspectedPerson"("idNumber");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_severity_idx" ON "SuspectedPerson"("severity");
CREATE INDEX IF NOT EXISTS "SuspectedPerson_is_active_idx" ON "SuspectedPerson"("is_active");
CREATE INDEX IF NOT EXISTS "SuspectMatch_suspectedPersonId_idx" ON "SuspectMatch"("suspectedPersonId");
CREATE INDEX IF NOT EXISTS "SuspectMatch_isRead_idx" ON "SuspectMatch"("isRead");
CREATE INDEX IF NOT EXISTS "SuspectMatch_createdAt_idx" ON "SuspectMatch"("createdAt");
CREATE INDEX IF NOT EXISTS "SuspectMatch_guestPhone_idx" ON "SuspectMatch"("guestPhone");
CREATE INDEX IF NOT EXISTS "SuspectMatch_guestIdNumber_idx" ON "SuspectMatch"("guestIdNumber");
CREATE INDEX IF NOT EXISTS "SuspectMatch_providerId_idx" ON "SuspectMatch"("providerId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_officerName_idx" ON "AuditLog"("officerName");
CREATE INDEX IF NOT EXISTS "Geofence_isActive_idx" ON "Geofence"("isActive");
CREATE INDEX IF NOT EXISTS "Geofence_severity_idx" ON "Geofence"("severity");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_createdAt_idx" ON "FrequentStayAlert"("createdAt");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_isReviewed_idx" ON "FrequentStayAlert"("isReviewed");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_riskLevel_idx" ON "FrequentStayAlert"("riskLevel");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_guestPhone_idx" ON "FrequentStayAlert"("guestPhone");
CREATE INDEX IF NOT EXISTS "FrequentStayAlert_guestIdNumber_idx" ON "FrequentStayAlert"("guestIdNumber");
CREATE INDEX IF NOT EXISTS "Subscription_endDate_idx" ON "Subscription"("endDate");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_subscriptionId_idx" ON "SubscriptionPayment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_createdAt_idx" ON "SubscriptionPayment"("createdAt");
`;

async function ensureDatabase(client: PrismaClientInstance): Promise<void> {
  // 1. Check if User table exists
  const rows: Array<{ exists: boolean }> = await client.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'User'
    ) as exists`
  );

  if (rows[0]?.exists) {
    return; // Tables already exist
  }

  console.log("[db] User table missing. Creating all tables...");

  // 2. Create enums + tables
  await client.$executeRawUnsafe(SCHEMA_SQL);

  // 3. Add foreign keys + indexes
  await client.$executeRawUnsafe(POST_INIT_SQL);

  console.log("[db] All tables created.");

  // 4. Seed SUPERUSER
  const existing = await client.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const hashed = await bcrypt.hash("Admin@2024", 12);
    await client.user.create({
      data: {
        username: "admin",
        password: hashed,
        name: "System Administrator",
        role: "SUPERUSER",
        permissions: "[]",
        policeRank: "",
      },
    });
    console.log("[db] SUPERUSER 'admin' created.");
  }

  // 5. Seed PoliceAlertConfig
  await client.policeAlertConfig.upsert({
    where: { id: "default-alert-config" },
    update: {},
    create: { id: "default-alert-config" },
  });
}

function createPrismaClient(): PrismaClientInstance {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[db] DATABASE_URL is not set. " +
        "Add it in Vercel Dashboard > Settings > Environment Variables."
    );
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["warn", "error"]
        : ["warn", "error"],
  }) as PrismaClientInstance;
}

function getDb(): PrismaClientInstance {
  if (!_db) {
    _db = createPrismaClient();
  }
  return _db;
}

function getInitPromise(client: PrismaClientInstance): Promise<void> {
  if (!_initPromise) {
    _initPromise = ensureDatabase(client);
  }
  return _initPromise;
}

/**
 * Lazy Proxy — every Prisma call awaits auto-init first.
 */
export const db = new Proxy({} as PrismaClientInstance, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return (...args: unknown[]) => {
        // Block until tables are ready, then run the actual Prisma call
        return getInitPromise(client).then(() =>
          (value as (...a: unknown[]) => Promise<unknown>).apply(client, args)
        );
      };
    }
    // For non-function properties, ensure init first
    return (async () => {
      await getInitPromise(client);
      return value;
    })();
  },
});
