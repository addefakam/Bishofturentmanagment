import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "@prisma/client/runtime/library";
import { getAuthContext, AuthError } from "@/lib/tenant";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (auth.role !== "POLICE" && auth.role !== "SUPERUSER") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;

    // Look up the provider
    const provider = await db.provider.findUnique({ where: { id } });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    if (provider.status !== "SUSPENDED") {
      return NextResponse.json(
        { error: "Only suspended guesthouses can be reactivated" },
        { status: 400 }
      );
    }

    const actorName = auth.userName || auth.name || "Unknown";

    // Reactivate: set back to APPROVED and clear all suspension fields
    const updatedProvider = await db.provider.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: auth.role,
        approvedAt: new Date(),
        suspensionReason: "",
        suspendedAt: null,
        suspendedBy: "",
        rejectionReason: "",
      },
    });

    // Notify the provider
    await db.notification.create({
      data: {
        title: "Guesthouse Reactivated",
        message: `Your guesthouse "${provider.name}" has been reactivated and is now fully active. You may resume normal operations.`,
        type: "SUCCESS",
        providerId: id,
        link: null,
      },
    });

    // Audit log
    await db.$executeRaw(
      sql`INSERT INTO "AuditLog" ("id", "officerName", "action", "targetId", "targetType", "details", "ipAddress", "createdAt")
       VALUES (${crypto.randomUUID()}, ${actorName}, ${"REACTIVATE_PROVIDER"}, ${id}, ${"Provider"}, ${`Reactivated provider "${provider.name}" (ID: ${id}). Previously suspended by: ${provider.suspendedBy || "unknown"}. Reason was: ${provider.suspensionReason || "none"}`}, ${req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || ""}, CURRENT_TIMESTAMP)`
    );

    return NextResponse.json({
      success: true,
      provider: updatedProvider,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Failed to reactivate provider";
    const status =
      message.includes("not found") ? 404 :
      message.includes("denied") ? 403 :
      message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
