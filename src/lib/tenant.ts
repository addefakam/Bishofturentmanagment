import { NextRequest } from "next/server";

export interface AuthContext {
  role: string;
  providerId: string | null;
  permissions: string[];
  policeRank: string;
  userName: string;
}

export function getAuthContext(req: NextRequest): AuthContext {
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
  return { role: role.toUpperCase(), providerId, permissions, policeRank, userName };
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
  blockSuperuser?: boolean;        // kept for backwards compat, now redundant
  requireSuperuserOrOperator?: boolean; // backwards compat alias for requireOperator
  requireOperator?: boolean;       // only OPERATOR can perform this action
  allowSuperuser?: boolean;        // explicitly allow SUPERUSER (settings, concerns)
  staffPermissionKey?: string;
  staffCanCreate?: boolean;
}

export function checkWritePermission(
  auth: AuthContext,
  opts: PermissionOptions = {}
): void {
  if (auth.role === "POLICE") throw new Error("Police cannot perform this action");

  // SUPERUSER: restricted to owner-only actions (settings, submit concerns)
  // Blocked from all other write operations
  if (auth.role === "SUPERUSER") {
    if (opts.allowSuperuser) return;
    throw new Error("Owners cannot perform this action. Contact your operator for assistance.");
  }

  // requireOperator / requireSuperuserOrOperator → only OPERATOR
  if (opts.requireOperator || opts.requireSuperuserOrOperator) {
    if (auth.role !== "OPERATOR") {
      throw new Error("Operator access required");
    }
    return;
  }

  // blockSuperuser is now redundant (SUPERUSER is blocked above) but kept for safety
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