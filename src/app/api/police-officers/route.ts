import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext, requirePolice } from "@/lib/tenant";
import { requirePoliceMinRank, POLICE_RANKS, type PoliceRank } from "@/lib/police-permissions";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth-utils";

/**
 * GET /api/police-officers — List all POLICE users (ADMIN only)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);

    const officers = await db.user.findMany({
      where: { role: "POLICE" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        permissions: true,
        providerId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(officers);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch officers";
    const status = message.includes("Police") || message.includes("rank") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/police-officers — Create new police officer (ADMIN only)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    requirePoliceMinRank(auth, "ADMIN");

    const body = await req.json();
    const { username, password, name, policeRank } = body;

    if (!username || !password || !name) {
      return NextResponse.json(
        { error: "username, password, and name are required" },
        { status: 400 }
      );
    }

    // Check for duplicate username
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    const rank = (policeRank && Object.values(POLICE_RANKS).includes(policeRank)
      ? policeRank
      : "OFFICER") as PoliceRank;

    // Hash the password before storing
    const hashedPassword = await hashPassword(password);

    const officer = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        role: "POLICE",
        permissions: JSON.stringify([`police_rank:${rank}`]),
        policeRank: rank,
      },
    });

    await logAudit(req, {
      action: "CREATE_OFFICER",
      targetId: officer.id,
      targetType: "User",
      details: JSON.stringify({ username, name, rank }),
    }).catch(() => {});

    return NextResponse.json(
      { ...officer, password: undefined },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create officer";
    const status = message.includes("Police") || message.includes("rank") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * PUT /api/police-officers — Update officer rank (ADMIN only)
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    requirePoliceMinRank(auth, "ADMIN");

    const body = await req.json();
    const { id, policeRank, name } = body;

    if (!id) {
      return NextResponse.json({ error: "Officer ID is required" }, { status: 400 });
    }

    const officer = await db.user.findUnique({ where: { id } });
    if (!officer || officer.role !== "POLICE") {
      return NextResponse.json({ error: "Officer not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (policeRank && Object.values(POLICE_RANKS).includes(policeRank)) {
      updateData.permissions = JSON.stringify([`police_rank:${policeRank}`]);
      updateData.policeRank = policeRank;
    }
    if (name) {
      updateData.name = name;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
    });

    await logAudit(req, {
      action: "UPDATE_OFFICER",
      targetId: id,
      targetType: "User",
      details: JSON.stringify({ rank: policeRank, name }),
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update officer";
    const status = message.includes("Police") || message.includes("rank") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/police-officers — Delete officer (ADMIN only)
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await getAuthContext(req);
    requirePolice(auth);
    requirePoliceMinRank(auth, "ADMIN");

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Officer ID is required" }, { status: 400 });
    }

    const officer = await db.user.findUnique({ where: { id } });
    if (!officer || officer.role !== "POLICE") {
      return NextResponse.json({ error: "Officer not found" }, { status: 404 });
    }

    await db.user.delete({ where: { id } });

    await logAudit(req, {
      action: "DELETE_OFFICER",
      targetId: id,
      targetType: "User",
      details: JSON.stringify({ username: officer.username }),
    }).catch(() => {});

    return NextResponse.json({ message: "Officer deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete officer";
    const status = message.includes("Police") || message.includes("rank") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
