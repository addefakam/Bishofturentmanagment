import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, getProviderFilter, checkWritePermission } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    // SUPERUSER cannot access the users list — use /api/owner-accounts instead
    if (auth.role === "SUPERUSER") {
      return NextResponse.json(
        { error: "Access denied. Use Owner Accounts to manage provider credentials." },
        { status: 403 }
      );
    }
    const { isPolice, providerId } = getProviderFilter(auth);

    const { searchParams } = req.nextUrl;
    const providerFilter = searchParams.get("providerId");

    const where: Record<string, unknown> = {};
    if (isPolice) {
      if (providerFilter) where.providerId = providerFilter;
    } else {
      where.providerId = providerId;
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        role: true,
        name: true,
        permissions: true,
        providerId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    const { providerId } = getProviderFilter(auth);
    checkWritePermission(auth, { requireSuperuserOrOperator: true });

    const body = await req.json();
    const { username, password, role, name, permissions, providerId: bodyProviderId } = body;

    if (!username || !password || !name || !role) {
      return NextResponse.json(
        { error: "username, password, name, and role are required" },
        { status: 400 }
      );
    }

    if (auth.role === "OPERATOR" && role !== "STAFF") {
      return NextResponse.json(
        { error: "Operators are only permitted to manage and create Staff accounts" },
        { status: 403 }
      );
    }

    const targetProviderId = bodyProviderId || providerId;

    const user = await db.user.create({
      data: {
        username,
        password,
        role,
        name,
        permissions: typeof permissions === "string" ? permissions : JSON.stringify(permissions || []),
        providerId: targetProviderId,
      },
    });

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const status =
      message.includes("required") ? 400 :
      message.includes("Unique") ? 409 :
      message.includes("permission") || message.includes("cannot") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}