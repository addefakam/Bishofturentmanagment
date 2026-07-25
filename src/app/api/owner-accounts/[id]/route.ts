import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/tenant";

// PUT /api/owner-accounts/[id] — OPERATOR resets username/password for owner or police accounts
// The [id] refers to the USER id.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(req);
    if (auth.role !== "OPERATOR") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { username, password } = body;

    if (!username && !password) {
      return NextResponse.json(
        { error: "At least username or password must be provided" },
        { status: 400 }
      );
    }

    // Find the target user
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only allow resetting credentials for SUPERUSER (owner) and POLICE accounts
    if (existing.role !== "SUPERUSER" && existing.role !== "POLICE") {
      return NextResponse.json(
        { error: "Only owner and police accounts can be managed here. Contact your operator for other user management." },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (username) {
      // Check uniqueness if changing username
      if (username !== existing.username) {
        const duplicate = await db.user.findUnique({ where: { username } });
        if (duplicate) {
          return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
        }
      }
      updateData.username = username;
    }
    if (password) {
      updateData.password = password;
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        providerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update account";
    const status =
      message.includes("not found") ? 404 :
      message.includes("taken") ? 409 :
      message.includes("denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}