import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/init-db";
import { db } from "@/lib/db";
import { logAudit, logAuditUnauthenticated } from "@/lib/audit";
import { hashPassword, verifyPassword, createToken, type JWTPayload } from "@/lib/auth-utils";

export async function POST(req: NextRequest) {
  try {
    // Ensure database tables exist before any Prisma operation
    await ensureDatabase();

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
      select: {
        id: true, username: true, name: true, role: true,
        password: true, providerId: true, permissions: true,
        policeRank: true,
        provider: { select: { id: true, name: true, status: true } },
      },
    });

    if (!user) {
      logAuditUnauthenticated(req, {
        action: "LOGIN_FAILED",
        details: `Failed login attempt for username: ${username}`,
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Verify password (supports both hashed and plain text for backward compat)
    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      logAuditUnauthenticated(req, {
        action: "LOGIN_FAILED",
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        providerName: user.provider?.name || "",
        details: `Failed login (wrong password) for: ${user.username}`,
      });
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // ── Auto-migrate: hash plain-text passwords in background (don't block response) ──
    if (!user.password.startsWith("$2")) {
      hashPassword(password).then((hashed) =>
        db.user.update({ where: { id: user.id }, data: { password: hashed } }).catch(() => {})
      );
    }

    const policeRank = user.policeRank || "";

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

    // Audit log login for ALL roles (using unauthenticated version since JWT isn't set yet)
    logAuditUnauthenticated(req, {
      action: "LOGIN",
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      providerName: user.provider?.name || "",
      targetId: user.id,
      targetType: "User",
      details: `Login: ${user.username} (${user.role}${user.policeRank ? "/" + user.policeRank : ""})`,
    });

    // Update last login
    db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {});

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
    console.error("[auth] Login error:", error);
    console.error("[auth] Error stack:", error instanceof Error ? error.stack : 'no stack');
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// ── Logout endpoint ──
export async function DELETE(req: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";

  // Audit log logout for ALL authenticated users
  try {
    const { verifyToken } = await import("@/lib/auth-utils");
    const token = req.cookies.get("ghms_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        logAuditUnauthenticated(req, {
          action: "LOGOUT",
          userId: payload.userId,
          userName: payload.name,
          userRole: payload.role,
          providerName: payload.providerName || "",
          details: `Logout: ${payload.username} (${payload.role})`,
        });
      }
    }
  } catch {
    // Logout audit is best-effort
  }

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
