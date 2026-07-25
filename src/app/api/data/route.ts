import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/tenant";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const providerId = searchParams.get("providerId");

    const providerFilter: Prisma.ProviderWhereInput = providerId
      ? { id: providerId }
      : {};

    const providers = await db.provider.findMany({ where: providerFilter });

    const users = await db.user.findMany({
      where: providerId ? { providerId } : undefined,
      select: { id: true, username: true, role: true, name: true, permissions: true, providerId: true, createdAt: true, updatedAt: true },
    });

    const rooms = await db.room.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const guests = await db.guest.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const reservations = await db.reservation.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const expenses = await db.expense.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const payments = await db.payment.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const settings = await db.settings.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const notifications = await db.notification.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const activityLogs = await db.activityLog.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const daytimeServices = await db.daytimeService.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const daytimeBookings = await db.daytimeBooking.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const resources = await db.resource.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const housekeepingTasks = await db.housekeepingTask.findMany({
      where: providerId ? { providerId } : undefined,
    });

    const reviews = await db.review.findMany();

    const expenseCategories = await db.expenseCategory.findMany();

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
    const message = error instanceof Error ? error.message : "Failed to export data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    const body = await req.json();

    // Upsert providers
    if (body.providers?.length) {
      for (const p of body.providers) {
        if (p.id) {
          await db.provider.upsert({
            where: { id: p.id },
            update: p,
            create: p,
          });
        }
      }
    }

    // Upsert users
    if (body.users?.length) {
      for (const u of body.users) {
        if (u.id) {
          await db.user.upsert({
            where: { id: u.id },
            update: u,
            create: u,
          });
        }
      }
    }

    // Upsert rooms
    if (body.rooms?.length) {
      for (const r of body.rooms) {
        if (r.id) {
          await db.room.upsert({
            where: { id: r.id },
            update: r,
            create: r,
          });
        }
      }
    }

    // Upsert guests
    if (body.guests?.length) {
      for (const g of body.guests) {
        if (g.id) {
          await db.guest.upsert({
            where: { id: g.id },
            update: g,
            create: g,
          });
        }
      }
    }

    // Upsert reservations
    if (body.reservations?.length) {
      for (const r of body.reservations) {
        if (r.id) {
          await db.reservation.upsert({
            where: { id: r.id },
            update: r,
            create: r,
          });
        }
      }
    }

    // Upsert expenses
    if (body.expenses?.length) {
      for (const e of body.expenses) {
        if (e.id) {
          await db.expense.upsert({
            where: { id: e.id },
            update: e,
            create: e,
          });
        }
      }
    }

    // Upsert settings
    if (body.settings?.length) {
      for (const s of body.settings) {
        if (s.id) {
          await db.settings.upsert({
            where: { id: s.id },
            update: s,
            create: s,
          });
        }
      }
    }

    // Upsert daytime services
    if (body.daytimeServices?.length) {
      for (const s of body.daytimeServices) {
        if (s.id) {
          await db.daytimeService.upsert({
            where: { id: s.id },
            update: s,
            create: s,
          });
        }
      }
    }

    // Upsert daytime bookings
    if (body.daytimeBookings?.length) {
      for (const b of body.daytimeBookings) {
        if (b.id) {
          await db.daytimeBooking.upsert({
            where: { id: b.id },
            update: b,
            create: b,
          });
        }
      }
    }

    // Upsert resources
    if (body.resources?.length) {
      for (const r of body.resources) {
        if (r.id) {
          await db.resource.upsert({
            where: { id: r.id },
            update: r,
            create: r,
          });
        }
      }
    }

    // Upsert housekeeping tasks
    if (body.housekeepingTasks?.length) {
      for (const t of body.housekeepingTasks) {
        if (t.id) {
          await db.housekeepingTask.upsert({
            where: { id: t.id },
            update: t,
            create: t,
          });
        }
      }
    }

    // Upsert reviews
    if (body.reviews?.length) {
      for (const r of body.reviews) {
        if (r.id) {
          await db.review.upsert({
            where: { id: r.id },
            update: r,
            create: r,
          });
        }
      }
    }

    // Upsert expense categories
    if (body.expenseCategories?.length) {
      for (const c of body.expenseCategories) {
        if (c.id) {
          await db.expenseCategory.upsert({
            where: { id: c.id },
            update: c,
            create: c,
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Data imported successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to import data";
    const status = message.includes("permission") || message.includes("required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}