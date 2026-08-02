/**
 * Subscription helper library
 *
 * Handles subscription status calculation, cycle durations,
 * and auto-creation of trial subscriptions.
 */

// ── Cycle duration in days ──
export const CYCLE_DAYS: Record<string, number> = {
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMI_ANNUAL: 180,
  YEARLY: 365,
};

// ── Warning period: days before expiry to show warning ──
export const WARNING_DAYS = 7;

// ── Grace period: days after expiry before suspension ──
export const GRACE_DAYS = 2;

// ── Free trial days when provider is approved ──
export const TRIAL_DAYS = 15;

export type SubscriptionStatus = "ACTIVE" | "WARNING" | "GRACE" | "SUSPENDED";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  daysRemaining: number; // positive = still active, negative = expired
  endDate: string;
  cycle: string;
  price: number;
  providerName: string;
  ownerName: string;
  phone: string;
}

/**
 * Calculate subscription status based on endDate.
 * Returns status + days remaining (positive = future, negative = past).
 * Accepts optional warningDays and graceDays (falls back to module-level constants).
 */
export function calcSubscriptionStatus(
  endDate: Date | string,
  options?: { warningDays?: number; graceDays?: number }
): {
  status: SubscriptionStatus;
  daysRemaining: number;
} {
  const wd = options?.warningDays ?? WARNING_DAYS;
  const gd = options?.graceDays ?? GRACE_DAYS;
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining > wd) {
    return { status: "ACTIVE", daysRemaining };
  }
  if (daysRemaining > 0) {
    return { status: "WARNING", daysRemaining };
  }
  if (daysRemaining > -gd) {
    return { status: "GRACE", daysRemaining };
  }
  return { status: "SUSPENDED", daysRemaining };
}

/**
 * Calculate the next period end date.
 * Extends from the later of: now or current endDate.
 */
export function calcNextEndDate(
  currentEndDate: Date | string,
  cycle: string
): Date {
  const base = new Date(Math.max(Date.now(), new Date(currentEndDate).getTime()));
  const days = CYCLE_DAYS[cycle] || CYCLE_DAYS.MONTHLY;
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Format days remaining for display.
 */
export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining > 0) {
    if (daysRemaining === 1) return "1 day remaining";
    return `${daysRemaining} days remaining`;
  }
  if (daysRemaining === 0) return "Expires today";
  const abs = Math.abs(daysRemaining);
  if (abs === 1) return "Expired 1 day ago";
  return `Expired ${abs} days ago`;
}

/**
 * Format cycle for display.
 */
export function formatCycle(cycle: string): string {
  switch (cycle) {
    case "MONTHLY": return "Monthly";
    case "QUARTERLY": return "Quarterly";
    case "SEMI_ANNUAL": return "Semi-Annual";
    case "YEARLY": return "Yearly";
    default: return cycle;
  }
}

/**
 * Get status badge color classes.
 */
export function getStatusBadgeClasses(status: SubscriptionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "WARNING":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "GRACE":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "SUSPENDED":
      return "bg-slate-100 text-slate-800 border-slate-200";
    default:
      return "bg-slate-100 text-slate-800 border-slate-200";
  }
}
