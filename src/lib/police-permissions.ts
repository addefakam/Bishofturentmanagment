// Police sub-ranks and their permissions
export const POLICE_RANKS = {
  ADMIN: "ADMIN",
  DETECTIVE: "DETECTIVE",
  OFFICER: "OFFICER",
  VIEWER: "VIEWER",
} as const;

export type PoliceRank = (typeof POLICE_RANKS)[keyof typeof POLICE_RANKS];

// What each rank can access (police nav page keys)
export const POLICE_RANK_PERMISSIONS: Record<PoliceRank, string[]> = {
  ADMIN: [
    "police-dashboard",
    "providers",
    "police-guests",
    "suspect-alerts",
    "suspected-persons",
    "police-investigation",
    "police-security",
    "police-scanner",
    "notifications",
    "owner-accounts",
  ],
  DETECTIVE: [
    "police-dashboard",
    "providers",
    "police-guests",
    "suspect-alerts",
    "suspected-persons",
    "police-investigation",
    "police-scanner",
    "notifications",
    "owner-accounts",
  ],
  OFFICER: [
    "police-dashboard",
    "providers",
    "police-guests",
    "suspect-alerts",
    "suspected-persons",
    "police-investigation",
    "police-scanner",
    "notifications",
    "owner-accounts",
  ],
  VIEWER: ["police-dashboard", "providers", "police-guests", "notifications"],
};

export const RANK_LABELS: Record<PoliceRank, string> = {
  ADMIN: "Police Admin",
  DETECTIVE: "Detective",
  OFFICER: "Officer",
  VIEWER: "Viewer",
};

export const RANK_BADGE_CLASSES: Record<PoliceRank, string> = {
  ADMIN: "bg-amber-100 text-amber-800 border-amber-200",
  DETECTIVE: "bg-violet-100 text-violet-800 border-violet-200",
  OFFICER: "bg-sky-100 text-sky-800 border-sky-200",
  VIEWER: "bg-slate-100 text-slate-600 border-slate-200",
};

// API-level permission checks
export function requirePoliceRank(_auth: {
  role: string;
  permissions: string[];
}): void {
  if (_auth.role !== "POLICE") throw new Error("Police access required");
  // ADMIN has access to everything
  // If no specific rank required, any police user passes
}

export function requirePoliceMinRank(
  auth: { role: string; policeRank?: string },
  minRank: PoliceRank,
): void {
  if (auth.role !== "POLICE") throw new Error("Police access required");
  const rank = (auth.policeRank || "OFFICER") as PoliceRank;
  const hierarchy: Record<PoliceRank, number> = {
    VIEWER: 0,
    OFFICER: 1,
    DETECTIVE: 2,
    ADMIN: 3,
  };
  if ((hierarchy[rank] || 0) < (hierarchy[minRank] || 0)) {
    throw new Error(`Requires ${RANK_LABELS[minRank]} rank or higher`);
  }
}
