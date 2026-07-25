import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth-utils";

/**
 * ONE-TIME SETUP: Creates a SUPERUSER account if none exists.
 * Run this once on Vercel, then DELETE this route.
 * 
 * GET /api/setup-superuser
 */
export async function GET() {
  try {
    // Check if any SUPERUSER already exists
    const existingSuper = await db.user.findFirst({
      where: { role: "SUPERUSER" },
    });

    if (existingSuper) {
      return NextResponse.json({
        status: "already_exists",
        message: "SUPERUSER already exists",
        user: {
          id: existingSuper.id,
          username: existingSuper.username,
          name: existingSuper.name,
          role: existingSuper.role,
          providerId: existingSuper.providerId,
        },
      });
    }

    // Check if "superadmin" username is taken (even if not SUPERUSER role)
    const existing = await db.user.findUnique({
      where: { username: "superadmin" },
    });

    if (existing) {
      return NextResponse.json({
        status: "username_taken",
        message: 'Username "superadmin" already exists with a different role',
        user: {
          id: existing.id,
          username: existing.username,
          role: existing.role,
        },
      });
    }

    // Hash the password with bcrypt
    const hashedPassword = await hashPassword("admin123");

    // Create the SUPERUSER (no provider — system-wide)
    const superuser = await db.user.create({
      data: {
        username: "superadmin",
        password: hashedPassword,
        role: "SUPERUSER",
        name: "System Admin",
        permissions: "[]", // No page restrictions — has all access
        policeRank: "",
      },
    });

    return NextResponse.json({
      status: "created",
      message: "SUPERUSER account created successfully",
      user: {
        id: superuser.id,
        username: superuser.username,
        name: superuser.name,
        role: superuser.role,
        providerId: superuser.providerId,
      },
      credentials: {
        username: "superadmin",
        password: "admin123",
        note: "Change this password after first login!",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}
