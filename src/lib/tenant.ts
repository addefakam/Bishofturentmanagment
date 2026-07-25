import { NextRequest } from "next/server";
import { verifyToken, type JWTPayload } from "@/lib/auth-utils";
import { db } from "@/lib/db";

export interface AuthContext {
  userId: string;
  role: string;
  providerId: string | null;
  permissions: string[];
  policeRank: string;
  userName: string;
  // Raw JWT payload for reference
  token: JWTPayload;
}

/**
 * Server-side auth: reads JWT from httpOnly cookie and verifies it.
 * Falls back to header-based auth for backward compatibility during migration.
 * Once all clients use cookies, the header fallback can be removed.
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  // ── Primary: Read JWT from httpOnly cookie ──
  const token = req.cookies.get("ghms_token")?.value;

  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      return {
        userId: payload.userId,
        role: payload.role,
        providerId: payload.providerId,
        permissions: payload.permissions,
        policeRank: payload.policeRank,
        userName: payload.name,
        token: payload,
      };
    }
  }

  // ── Fallback: Header-based auth (backward compat during migration) ──
  // This allows the existing client to keep working until it's updated to use cookies
  const role = req.headers.get("x-user-role") || "";
  const providerId = req.headers.get("x-provider-id") || null;
  const permStr = req.headers.get("x-user-permissions") || "[]";
  const policeRank = req.headers.get("x-user-police-rank") || "";
  const userName = req.headers.get("x-user-name") || "";
  let permissions: string[] = [];
  try {
    permissions = JSON.parse(permStr);
  } catch {
    permissions = [];
  }

  return {
    userId: "",
    role: role.toUpperCase(),
    providerId,
    permissions,
    policeRank,
    userName,
    token: {
      userId: "",
      username: userName,
      role: role.toUpperCase(),
      providerId,
      permissions,
      policeRank,
      name: userName,
    },
  };
}

export function getProviderFilter(auth: AuthContext) {
  if (auth.role === "POLICE") {
    return { isPolice: true, providerId: undefined as undefined };
  }
  return { isPolice: false, providerId: auth.providerId || "" };
}

export function requirePolice(auth: AuthContext): void {
  if (auth.role !== "POLICE") throw new Error("Police access required");
}

export function blockPoliceWrites(auth: AuthContext): void {
  if (auth.role === "POLICE") throw new Error("Police cannot write data");
}

interface PermissionOptions {
  staffOnlyWrite?: boolean;
  requireSuperuserOrOperator?: boolean;
  requireOperator?: boolean;
  allowSuperuser?: boolean;
  staffPermissionKey?: string;
  staffCanCreate?: boolean;
}

export function checkWritePermission(
  auth: AuthContext,
  opts: PermissionOptions = {}
): void {
  if (auth.role === "POLICE") throw new Error("Police cannot perform this action");

  if (auth.role === "SUPERUSER") {
    if (opts.allowSuperuser) return;
    throw new Error("Owners cannot perform this action. Contact your operator for assistance.");
  }

  if (opts.requireOperator || opts.requireSuperuserOrOperator) {
    if (auth.role !== "OPERATOR") {
      throw new Error("Operator access required");
    }
    return;
  }

  if (auth.role === "STAFF") {
    if (opts.staffOnlyWrite) {
      throw new Error("Staff read-only for this section");
    }
    if (opts.staffPermissionKey) {
      const has = auth.permissions.includes(opts.staffPermissionKey);
      if (!has) {
        if (!opts.staffCanCreate) {
          throw new Error(`Staff lacks '${opts.staffPermissionKey}' permission`);
        }
      }
    } else {
      throw new Error("Staff cannot perform this action");
    }
  }
}
