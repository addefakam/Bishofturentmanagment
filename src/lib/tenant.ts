import { NextRequest } from "next/server";

export interface AuthContext {
  role: string;
  providerId: string | null;
  permissions: string[];
}

export function getAuthContext(req: NextRequest): AuthContext {
  const role = req.headers.get("x-user-role") || "";
  const providerId = req.headers.get("x-provider-id") || null;
  const permStr = req.headers.get("x-user-permissions") || "[]";
  let permissions: string[] = [];
  try {
    permissions = JSON.parse(permStr);
  } catch {
    permissions = [];
  }
  return { role: role.toUpperCase(), providerId, permissions };
}

export function getProviderFilter(auth: AuthContext) {
  // SYSTEM_ADMIN and POLICE see all providers
  if (auth.role === "SYSTEM_ADMIN" || auth.role === "POLICE") {
    return { isPolice: true, providerId: undefined as undefined };
  }
  return { isPolice: false, providerId: auth.providerId || "" };
}

export function requirePolice(auth: AuthContext): void {
  if (auth.role !== "POLICE" && auth.role !== "SYSTEM_ADMIN") {
    throw new Error("Police access required");
  }
}

export function blockPoliceWrites(auth: AuthContext): void {
  if (auth.role === "POLICE") throw new Error("Police cannot write data");
}

interface PermissionOptions {
  staffOnlyWrite?: boolean;
  blockSuperuser?: boolean;
  requireSuperuserOrOperator?: boolean;
  staffPermissionKey?: string;
  staffCanCreate?: boolean;
}

export function checkWritePermission(
  auth: AuthContext,
  opts: PermissionOptions = {}
): void {
  // SYSTEM_ADMIN can do anything
  if (auth.role === "SYSTEM_ADMIN") return;

  if (auth.role === "POLICE") throw new Error("Police cannot perform this action");

  if (opts.requireSuperuserOrOperator) {
    if (auth.role !== "SUPERUSER" && auth.role !== "OPERATOR") {
      throw new Error("Superuser or Operator access required");
    }
    return;
  }

  if (opts.blockSuperuser && auth.role === "SUPERUSER") {
    throw new Error("Superusers cannot perform this action");
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