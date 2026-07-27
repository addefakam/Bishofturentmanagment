import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth-utils";

/**
 * GET /api/joint-ops/users
 *
 * Returns all user accounts in the system. Requires active joint session.
 */
export async function GET(req: NextRequest) {
  try {
    // Verify joint session
    const primaryToken = req.cookies.get("ghms_token")?.value;
    const jointToken = req.cookies.get("ghms_token_joint")?.value;
    if (!primaryToken || !jointToken) {
      return NextResponse.json({ error: "Joint session required." }, { status: 403 });
    }

    const [primary, joint] = await Promise.all([
      verifyToken(primaryToken),
      verifyToken(jointToken),
    ]);
    if (!primary || !joint) {
      return NextResponse.json({ error: "Sessions expired." }, { status: 401 });
    }

    const isPrimarySuperuser = primary.role === "SUPERUSER";
    const isPrimaryPoliceAdmin = primary.role === "POLICE" && primary.policeRank === "ADMIN";
    const isJointSuperuser = joint.role === "SUPERUSER";
    const isJointPoliceAdmin = joint.role === "POLICE" && joint.policeRank === "ADMIN";

    const validCombo =
      (isPrimarySuperuser && isJointPoliceAdmin) || (isPrimaryPoliceAdmin && isJointSuperuser);
    if (!validCombo) {
      return NextResponse.json({ error: "Invalid role combination." }, { status: 403 });
    }

    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        policeRank: true,
        providerId: true,
        createdAt: true,
        provider: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        providerName: u.provider?.name || null,
      })),
    });
  } catch (error) {
    console.error("Joint ops users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
