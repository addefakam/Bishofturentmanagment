import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/tenant";

// GET /api/owner-accounts — OPERATOR lists providers with owner accounts + police accounts
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthContext(req);
    if (auth.role !== "OPERATOR") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch all providers with their SUPERUSER (owner) user accounts
    const providers = await db.provider.findMany({
      select: {
        id: true,
        name: true,
        ownerName: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        users: {
          where: { role: "SUPERUSER" },
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            providerId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch all POLICE user accounts
    const policeUsers = await db.user.findMany({
      where: { role: "POLICE" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        providerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ providers, policeUsers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}