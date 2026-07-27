import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { verifyToken } from "@/lib/auth-utils";

/**
 * DELETE /api/auth/joint-logout
 *
 * Clears the `ghms_token_joint` cookie, ending the joint session.
 * The primary session remains active.
 */
export async function DELETE(req: NextRequest) {
  try {
    const jointToken = req.cookies.get("ghms_token_joint")?.value;
    const primaryToken = req.cookies.get("ghms_token")?.value;

    if (jointToken && primaryToken) {
      // Log who ended the joint session
      const primary = await verifyToken(primaryToken);
      if (primary) {
        await logAudit(req, {
          action: "JOINT_SESSION_END",
          targetId: "joint-session",
          targetType: "Session",
          details: `Joint session ended by ${primary.name} (${primary.username})`,
        });
      }
    }

    const isProduction = process.env.NODE_ENV === "production";
    const response = NextResponse.json({ success: true, message: "Joint session ended." });

    response.cookies.set("ghms_token_joint", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Joint logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
