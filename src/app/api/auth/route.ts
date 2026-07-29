import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashPassword, verifyPassword, createToken, type JWTPayload } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { username },
      include: { provider: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password (supports both hashed and plain text for backward compat)
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // ── Auto-migrate: if password is plain text, hash it now ──
    if (!user.password.startsWith("$2")) {
      const hashed = await hashPassword(password);
      await db.user.update({
        where: { id: user.id },
        data: { password: hashed },
      });
    }

    let policeRank = user.policeRank || "";
    if (!policeRank) {
      try {
        const rawUser: { policeRank: string }[] = await db.$queryRawUnsafe(
          `SELECT "policeRank" FROM "User" WHERE "id" = ?`,
          user.id
        );
        if (Array.isArray(rawUser) && rawUser[0]?.policeRank) {
          policeRank = rawUser[0].policeRank;
        }
      } catch {
        // Column might not exist yet
      }
    }

    // POLICE and system admin SUPERUSER (no provider) can login directly
    if (user.role !== "POLICE" && user.providerId) {
      if (!user.provider || user.provider.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Your registration is pending approval. Please wait for police to approve your account." },
          { status: 403 }
        );
      }
    }

    let permissions: string[] = [];
    try {
      permissions = JSON.parse(user.permissions);
    } catch {
      permissions = [];
    }

    if (user.role === "POLICE") {
      logAudit(req, { action: "LOGIN", targetId: user.id, targetType: "User", details: `Police login: ${user.username}` });
    }

    // ── Create JWT token ──
    const tokenPayload: JWTPayload = {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      providerId: user.providerId,
      permissions,
      policeRank,
      providerName: user.provider?.name ?? undefined,
    };

    const token = await createToken(tokenPayload);

    // Set token as httpOnly cookie (secure in production)
    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        providerId: user.providerId,
        permissions,
        policeRank,
      },
      providerName: user.provider?.name ?? null,
    });

    response.cookies.set("ghms_token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Login error:", detail);
    return NextResponse.json(
      { error: "Internal server error", detail },
      { status: 500 }
    );
  }
}

// ── Logout endpoint ──
export async function DELETE() {
  const isProduction = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ success: true });
  // Clear primary session
  response.cookies.set("ghms_token", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  // Also clear joint session if active
  response.cookies.set("ghms_token_joint", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
