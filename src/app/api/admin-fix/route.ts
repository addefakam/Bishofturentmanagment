import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth-utils";

// ── TEMPORARY ENDPOINT — DELETE AFTER USE ──
// This endpoint diagnoses and fixes the `admin` user in production.
// It is gated by a hardcoded secret in the source code (committed only temporarily).

const EXPECTED_SECRET = "fix-admin-user-2026-jul-27-temporary";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const fix = url.searchParams.get("fix") === "true";

  if (secret !== EXPECTED_SECRET) {
    return NextResponse.json(
      { error: "Unauthorized. Provide ?secret=<secret> to access." },
      { status: 401 }
    );
  }

  // ── Diagnostic: report env var status ──
  const envStatus = {
    JWT_SECRET_set: !!process.env.JWT_SECRET,
    JWT_SECRET_length: process.env.JWT_SECRET?.length || 0,
    TURSO_DATABASE_URL_set: !!process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN_set: !!process.env.TURSO_AUTH_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
  };

  try {
    // ── List all users (without passwords) ──
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        name: true,
        providerId: true,
        policeRank: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!fix) {
      return NextResponse.json({
        mode: "diagnostic",
        env: envStatus,
        usersCount: users.length,
        users,
        note: "Pass &fix=true to upsert the admin user as SUPERUSER.",
      });
    }

    // ── Fix mode: find existing admin user, then update or create ──
    const adminPassword = await hashPassword("123");

    const existing = await db.user.findFirst({
      where: { username: "admin" },
    });

    let adminUser;
    let action: string;

    if (existing) {
      // Update existing admin user to SUPERUSER
      adminUser = await db.user.update({
        where: { id: existing.id },
        data: {
          role: "SUPERUSER",
          name: "System Admin",
          password: adminPassword,
          providerId: null,
          policeRank: "",
          permissions: JSON.stringify([
            "reservations",
            "guests",
            "rooms",
            "dashboard",
            "reports",
            "expenses",
            "users",
            "settings",
            "police",
            "providers",
            "owner-accounts",
            "guesthouses",
          ]),
        },
      });
      action = "updated-existing";
    } else {
      // Create new admin user as SUPERUSER
      adminUser = await db.user.create({
        data: {
          username: "admin",
          password: adminPassword,
          role: "SUPERUSER",
          name: "System Admin",
          providerId: null,
          policeRank: "",
          permissions: JSON.stringify([
            "reservations",
            "guests",
            "rooms",
            "dashboard",
            "reports",
            "expenses",
            "users",
            "settings",
            "police",
            "providers",
            "owner-accounts",
            "guesthouses",
          ]),
        },
      });
      action = "created-new";
    }

    return NextResponse.json({
      mode: "fix-applied",
      action,
      env: envStatus,
      adminUser: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        name: adminUser.name,
        providerId: adminUser.providerId,
        policeRank: adminUser.policeRank,
      },
      message: "Admin user is now SUPERUSER. Try logging in with admin / 123.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "DB operation failed",
        detail: error instanceof Error ? error.message : String(error),
        env: envStatus,
      },
      { status: 500 }
    );
  }
}
