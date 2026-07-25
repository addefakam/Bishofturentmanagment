import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

    // Extract policeRank safely (field may not exist yet in older databases)
    let policeRank = "";
    try {
      const rawUser: any = await db.$queryRawUnsafe(`SELECT "policeRank" FROM "User" WHERE "id" = '${user.id}'`);
      if (Array.isArray(rawUser) && rawUser[0] && rawUser[0].policeRank) {
        policeRank = rawUser[0].policeRank;
      }
    } catch {
      // Column might not exist yet
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

    return NextResponse.json({
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
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}