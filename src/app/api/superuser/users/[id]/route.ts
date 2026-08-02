import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/init-db";
import { db } from "@/lib/db";
import { getAuthContext, AuthError } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth-utils";

// GET /api/superuser/users/[id] — Get single user details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabase();

    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        policeRank: true,
        permissions: true,
        providerId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        provider: {
          select: { id: true, name: true, status: true, ownerName: true, email: true, phone: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/superuser/users/[id] — Update user
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabase();

    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { username, password, name, email, phone, role, policeRank, permissions, providerId, isActive } = body;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check username uniqueness if changing
    if (username && username !== existing.username) {
      const dup = await db.user.findUnique({ where: { username } });
      if (dup) {
        return NextResponse.json({ error: "Username already exists" }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (username !== undefined) updateData.username = username;
    if (password) updateData.password = await hashPassword(password);
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (role !== undefined) updateData.role = role;
    if (policeRank !== undefined) updateData.policeRank = role === "POLICE" ? policeRank : "";
    if (permissions !== undefined) {
      updateData.permissions = typeof permissions === "string" ? permissions : JSON.stringify(permissions || []);
    }
    if (providerId !== undefined) updateData.providerId = providerId || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        policeRank: true,
        permissions: true,
        providerId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        provider: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/superuser/users/[id] — Delete user (prevent self-deletion)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabase();

    const auth = await getAuthContext(req);
    if (auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Superuser access required" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === auth.userId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
