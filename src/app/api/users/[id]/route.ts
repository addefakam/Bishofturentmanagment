import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, checkWritePermission } from "@/lib/tenant";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, { requireSuperuserOrOperator: true });

    const { id } = await params;
    const body = await req.json();

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // OPERATOR can only edit STAFF accounts
    if (auth.role === "OPERATOR") {
      if (existing.role !== "STAFF") {
        return NextResponse.json(
          { error: "Operators are only permitted to manage Staff accounts" },
          { status: 403 }
        );
      }
      if (body.role && body.role !== "STAFF") {
        return NextResponse.json(
          { error: "Operators cannot change user roles to non-Staff" },
          { status: 403 }
        );
      }
    }

    // SUPERUSER cannot modify SYSTEM_ADMIN or POLICE accounts
    if (auth.role === "SUPERUSER" && (existing.role === "SYSTEM_ADMIN" || existing.role === "POLICE")) {
      return NextResponse.json(
        { error: "Owners cannot modify System Admin or Police accounts" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.username !== undefined) updateData.username = body.username;
    if (body.password) updateData.password = body.password;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.permissions !== undefined) {
      updateData.permissions = typeof body.permissions === "string"
        ? body.permissions
        : JSON.stringify(body.permissions);
    }
    if (body.providerId !== undefined) updateData.providerId = body.providerId;
    if (body.disabled !== undefined) updateData.disabled = body.disabled;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        name: true,
        permissions: true,
        providerId: true,
        disabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    const status =
      message.includes("not found") ? 404 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    checkWritePermission(auth, { requireSuperuserOrOperator: true });

    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot delete self
    const requesterId = req.headers.get("x-user-id");
    if (requesterId && requesterId === id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 });
    }

    // OPERATOR can only delete STAFF
    if (auth.role === "OPERATOR" && existing.role !== "STAFF") {
      return NextResponse.json(
        { error: "Operators are only permitted to delete Staff accounts" },
        { status: 403 }
      );
    }

    // SUPERUSER cannot delete SYSTEM_ADMIN or POLICE
    if (auth.role === "SUPERUSER" && (existing.role === "SYSTEM_ADMIN" || existing.role === "POLICE")) {
      return NextResponse.json(
        { error: "Owners cannot delete System Admin or Police accounts" },
        { status: 403 }
      );
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    const status =
      message.includes("not found") ? 404 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}