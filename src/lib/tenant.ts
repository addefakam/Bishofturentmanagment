import { NextRequest } from "next/server";
import { verifyToken, type JWTPayload } from "@/lib/auth-utils";

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
 * No header-based fallback — JWT is the only source of truth.
 * Throws on missing/invalid token so the API route returns 401.
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext> {
  const token = req.cookies.get("ghms_token")?.value;

  if (!token) {
    throw new AuthError("Not authenticated", 401);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthError("Invalid or expired session", 401);
  }

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

/**
 * Thrown when authentication fails. API routes should catch this
 * and return a 401 with the message.
 */
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export function getProviderFilter(auth: AuthContext) {
  if (auth.role === "POLICE") {
    return { isPolice: true, providerId: undefined as undefined };
  }
  return { isPolice: false, providerId: auth.providerId || undefined };
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
  blockSuperuser?: boolean;
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
    if (opts.blockSuperuser) {
      throw new Error("Owners cannot perform this action. Contact your operator for assistance.");
    }
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
