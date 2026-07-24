import { db } from "./db";
import { getAuthContext } from "./tenant";
import { NextRequest } from "next/server";

interface LogAuditOptions {
  action: string;
  targetId?: string;
  targetType?: string;
  details?: string;
}

/**
 * Log an audit event. Designed to be called fire-and-forget — errors are
 * caught and logged to console but never thrown so callers aren't affected.
 */
export async function logAudit(
  req: NextRequest,
  opts: LogAuditOptions,
): Promise<void> {
  try {
    const auth = getAuthContext(req);
    const officerName = auth.role === "POLICE" ? auth.role : "System";
    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || "";

    await db.auditLog.create({
      data: {
        officerName,
        action: opts.action,
        targetId: opts.targetId || null,
        targetType: opts.targetType || "",
        details: opts.details || null,
        ipAddress,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[audit] Failed to write audit log:", msg);
    // Intentionally swallowed — audit logging must never break the caller
  }
}
