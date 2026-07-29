import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

/**
 * Turso/LibSQL does NOT reliably support Prisma's upsert() (INSERT ... ON CONFLICT).
 * This helper replaces upsert with findFirst + create/update pattern.
 */
async function safeUpsert<T extends { id: string }>(
  model: { findFirst: (args: { where: { id: string } }) => Promise<T | null>; create: (args: { data: T }) => Promise<T>; update: (args: { where: { id: string }; data: Partial<T> }) => Promise<T> },
  data: T,
): Promise<T> {
  const existing = await model.findFirst({ where: { id: data.id } });
  if (existing) {
    return model.update({ where: { id: data.id }, data: data as Partial<T> });
  }
  return model.create({ data: data as T });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const providerId = searchParams.get("providerId");

    const providerFilter: Prisma.ProviderWhereInput = providerId
      ? { id: providerId }
      : {};

    // ── Run ALL 16 queries in parallel (no data dependencies between them) ──
    const [
      providers,
      users,
      rooms,
      guests,
      reservations,
      expenses,
      payments,
      settings,
      notifications,
      activityLogs,
      daytimeServices,
      daytimeBookings,
      resources,
      housekeepingTasks,
      reviews,
      expenseCategories,
    ] = await Promise.all([
      db.provider.findMany({ where: providerFilter }),
      db.user.findMany({
        where: providerId ? { providerId } : undefined,
        select: { id: true, username: true, role: true, name: true, permissions: true, providerId: true, createdAt: true, updatedAt: true },
      }),
      db.room.findMany({ where: providerId ? { providerId } : undefined }),
      db.guest.findMany({ where: providerId ? { providerId } : undefined }),
      db.reservation.findMany({ where: providerId ? { providerId } : undefined }),
      db.expense.findMany({ where: providerId ? { providerId } : undefined }),
      db.payment.findMany({ where: providerId ? { providerId } : undefined }),
      db.settings.findMany({ where: providerId ? { providerId } : undefined }),
      db.notification.findMany({ where: providerId ? { providerId } : undefined }),
      db.activityLog.findMany({ where: providerId ? { providerId } : undefined }),
      db.daytimeService.findMany({ where: providerId ? { providerId } : undefined }),
      db.daytimeBooking.findMany({ where: providerId ? { providerId } : undefined }),
      db.resource.findMany({ where: providerId ? { providerId } : undefined }),
      db.housekeepingTask.findMany({ where: providerId ? { providerId } : undefined }),
      db.review.findMany(),
      db.expenseCategory.findMany(),
    ]);

    return NextResponse.json({
      providers,
      users,
      rooms,
      guests,
      reservations,
      expenses,
      payments,
      settings,
      notifications,
      activityLogs,
      daytimeServices,
      daytimeBookings,
      resources,
      housekeepingTasks,
      reviews,
      expenseCategories,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to export data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    // Audit log for data import (fire-and-forget)
    logAudit(req, {
      action: "DATA_IMPORT",
      targetType: "System",
      details: `Data import by ${auth.userName || auth.role}`,
    }).catch(() => {});

    const body = await req.json();

    // ── Import each model using findFirst + create/update (no upsert for Turso) ──

    // Providers
    if (body.providers?.length) {
      await Promise.all(
        body.providers.map((p: Record<string, unknown>) =>
          p.id ? safeUpsert(db.provider, p as any) : Promise.resolve()
        )
      );
    }

    // Users
    if (body.users?.length) {
      await Promise.all(
        body.users.map((u: Record<string, unknown>) =>
          u.id ? safeUpsert(db.user, u as any) : Promise.resolve()
        )
      );
    }

    // Rooms
    if (body.rooms?.length) {
      await Promise.all(
        body.rooms.map((r: Record<string, unknown>) =>
          r.id ? safeUpsert(db.room, r as any) : Promise.resolve()
        )
      );
    }

    // Guests
    if (body.guests?.length) {
      await Promise.all(
        body.guests.map((g: Record<string, unknown>) =>
          g.id ? safeUpsert(db.guest, g as any) : Promise.resolve()
        )
      );
    }

    // Reservations
    if (body.reservations?.length) {
      await Promise.all(
        body.reservations.map((r: Record<string, unknown>) =>
          r.id ? safeUpsert(db.reservation, r as any) : Promise.resolve()
        )
      );
    }

    // Expenses
    if (body.expenses?.length) {
      await Promise.all(
        body.expenses.map((e: Record<string, unknown>) =>
          e.id ? safeUpsert(db.expense, e as any) : Promise.resolve()
        )
      );
    }

    // Settings
    if (body.settings?.length) {
      await Promise.all(
        body.settings.map((s: Record<string, unknown>) =>
          s.id ? safeUpsert(db.settings, s as any) : Promise.resolve()
        )
      );
    }

    // Daytime services
    if (body.daytimeServices?.length) {
      await Promise.all(
        body.daytimeServices.map((s: Record<string, unknown>) =>
          s.id ? safeUpsert(db.daytimeService, s as any) : Promise.resolve()
        )
      );
    }

    // Daytime bookings
    if (body.daytimeBookings?.length) {
      await Promise.all(
        body.daytimeBookings.map((b: Record<string, unknown>) =>
          b.id ? safeUpsert(db.daytimeBooking, b as any) : Promise.resolve()
        )
      );
    }

    // Resources
    if (body.resources?.length) {
      await Promise.all(
        body.resources.map((r: Record<string, unknown>) =>
          r.id ? safeUpsert(db.resource, r as any) : Promise.resolve()
        )
      );
    }

    // Housekeeping tasks
    if (body.housekeepingTasks?.length) {
      await Promise.all(
        body.housekeepingTasks.map((t: Record<string, unknown>) =>
          t.id ? safeUpsert(db.housekeepingTask, t as any) : Promise.resolve()
        )
      );
    }

    // Reviews
    if (body.reviews?.length) {
      await Promise.all(
        body.reviews.map((r: Record<string, unknown>) =>
          r.id ? safeUpsert(db.review, r as any) : Promise.resolve()
        )
      );
    }

    // Expense categories
    if (body.expenseCategories?.length) {
      await Promise.all(
        body.expenseCategories.map((c: Record<string, unknown>) =>
          c.id ? safeUpsert(db.expenseCategory, c as any) : Promise.resolve()
        )
      );
    }

    return NextResponse.json({ success: true, message: "Data imported successfully" });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to import data";
    const status = message.includes("permission") || message.includes("required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
