"use client";

import { AlertTriangle, Clock, X } from "lucide-react";
import { formatDaysRemaining, type SubscriptionStatus } from "@/lib/subscription";
import { Button } from "@/components/ui/button";

interface SubscriptionBannerProps {
  status: SubscriptionStatus;
  daysRemaining: number;
  providerName?: string;
}

/**
 * SubscriptionBanner — shown at top of pages for WARNING/GRACE providers.
 * WARNING: amber banner with countdown to expiry.
 * GRACE: red banner with countdown to suspension.
 */
export default function SubscriptionBanner({
  status,
  daysRemaining,
  providerName,
}: SubscriptionBannerProps) {
  if (status === "ACTIVE" || status === "SUSPENDED") return null;

  const isGrace = status === "GRACE";
  const isWarning = status === "WARNING";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ${
        isGrace
          ? "border border-rose-200 bg-rose-50"
          : "border border-amber-200 bg-amber-50"
      }`}
    >
      <AlertTriangle
        className={`h-5 w-5 shrink-0 ${
          isGrace ? "text-rose-600" : "text-amber-600"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold ${
            isGrace ? "text-rose-800" : "text-amber-800"
          }`}
        >
          {isGrace
            ? "Subscription Expired — Grace Period"
            : "Subscription Expiring Soon"}
        </p>
        <p
          className={`text-xs ${
            isGrace ? "text-rose-700" : "text-amber-700"
          }`}
        >
          {isGrace
            ? `Your subscription expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? "s" : ""} ago. Renew within the grace period or your service will be suspended. New check-ins and reservations are disabled.`
            : `${formatDaysRemaining(daysRemaining)}. Please contact the administrator to renew your subscription.`}
        </p>
      </div>
      <div
        className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 ${
          isGrace
            ? "bg-rose-100 text-rose-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        <Clock className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">
          {Math.abs(daysRemaining)}d
        </span>
      </div>
    </div>
  );
}
