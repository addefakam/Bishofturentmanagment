import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-utils";

/**
 * GET /api/auth/joint-status
 *
 * Checks if both primary and joint sessions are active and valid.
 * Returns joint session info if both tokens are valid and roles are
 * SUPERUSER + POLICE(ADMIN).
 */
export async function GET(req: NextRequest) {
  try {
    const primaryToken = req.cookies.get("ghms_token")?.value;
    const jointToken = req.cookies.get("ghms_token_joint")?.value;

    // If either cookie is missing, no joint session
    if (!primaryToken || !jointToken) {
      return NextResponse.json({
        active: false,
        reason: !primaryToken ? "No primary session" : "No joint session",
      });
    }

    // Verify both tokens
    const [primary, joint] = await Promise.all([
      verifyToken(primaryToken),
      verifyToken(jointToken),
    ]);

    if (!primary || !joint) {
      return NextResponse.json({
        active: false,
        reason: !primary ? "Primary session expired" : "Joint session expired",
      });
    }

    // Check role combination
    const isPrimarySuperuser = primary.role === "SUPERUSER";
    const isPrimaryPoliceAdmin = primary.role === "POLICE" && primary.policeRank === "ADMIN";
    const isJointSuperuser = joint.role === "SUPERUSER";
    const isJointPoliceAdmin = joint.role === "POLICE" && joint.policeRank === "ADMIN";

    const validCombo =
      (isPrimarySuperuser && isJointPoliceAdmin) ||
      (isPrimaryPoliceAdmin && isJointSuperuser);

    if (!validCombo) {
      return NextResponse.json({
        active: false,
        reason: "Invalid role combination for joint session",
      });
    }

    // Determine who is superuser vs police admin
    const superuser = isPrimarySuperuser ? primary : joint;
    const policeAdmin = isPrimaryPoliceAdmin ? primary : joint;

    return NextResponse.json({
      active: true,
      superuser: {
        id: superuser.userId,
        username: superuser.username,
        name: superuser.name,
      },
      policeAdmin: {
        id: policeAdmin.userId,
        username: policeAdmin.username,
        name: policeAdmin.name,
        rank: policeAdmin.policeRank,
      },
    });
  } catch (error) {
    console.error("Joint status error:", error);
    return NextResponse.json({ active: false, reason: "Server error" }, { status: 500 });
  }
}
