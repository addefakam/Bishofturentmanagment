import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    if (!user || user.password !== password) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (user.disabled) {
      return NextResponse.json(
        { error: "Your account is disabled" },
        { status: 403 }
      );
    }

    // SYSTEM_ADMIN and POLICE can login without a provider
    if (user.role !== "SYSTEM_ADMIN" && user.role !== "POLICE") {
      if (!user.provider || user.provider.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Provider account is not approved" },
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

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        providerId: user.providerId,
        permissions,
      },
      providerName: user.provider?.name ?? null,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}