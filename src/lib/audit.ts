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
 * Log an audit event for ANY user role. Fire-and-forget — errors are
 * caught and logged to console but never thrown so callers aren't affected.
 */
export async function logAudit(
  req: NextRequest,
  opts: LogAuditOptions,
): Promise<void> {
  try {
    const auth = getAuthContext(req);
    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || "";
    const userAgent = req.headers.get("user-agent") || "";

    // Get provider name if available
    let providerName = "";
    if (auth.providerId) {
      try {
        const provider = await db.provider.findUnique({
          where: { id: auth.providerId },
          select: { name: true },
        });
        if (provider) providerName = provider.name;
      } catch {
        // Ignore — provider lookup is best-effort
      }
    }

    await db.auditLog.create({
      data: {
        userId: auth.userId,
        userName: auth.userName || "Unknown",
        userRole: auth.role,
        providerName,
        officerName: auth.role === "POLICE" ? (auth.userName || "Unknown Officer") : "",
        action: opts.action,
        targetId: opts.targetId || null,
        targetType: opts.targetType || "",
        details: opts.details || null,
        ipAddress,
        userAgent,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[audit] Failed to write audit log:", msg);
  }
}

/**
 * Log audit when user is not yet authenticated (e.g., login itself).
 * Falls back to raw values since there's no JWT to decode.
 */
export async function logAuditUnauthenticated(
  req: NextRequest,
  opts: LogAuditOptions & {
    userId?: string;
    userName?: string;
    userRole?: string;
    providerName?: string;
  },
): Promise<void> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || "";
    const userAgent = req.headers.get("user-agent") || "";

    await db.auditLog.create({
      data: {
        userId: opts.userId || "",
        userName: opts.userName || "",
        userRole: opts.userRole || "",
        providerName: opts.providerName || "",
        officerName: opts.userRole === "POLICE" ? (opts.userName || "") : "",
        action: opts.action,
        targetId: opts.targetId || null,
        targetType: opts.targetType || "",
        details: opts.details || null,
        ipAddress,
        userAgent,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[audit] Failed to write audit log:", msg);
  }
}
