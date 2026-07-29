"use client";

import { Lock, Clock, Phone, CreditCard, AlertTriangle, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LockoutInfo {
  providerName: string;
  ownerName: string;
  phone: string;
  status: "GRACE" | "SUSPENDED";
  daysRemaining: number;
  endDate: string;
  cycle: string;
  price: number;
}

/**
 * SubscriptionLockoutPage — shown when provider's subscription is SUSPENDED.
 * Full-screen lockout — cannot navigate away.
 */
export default function SubscriptionLockoutPage({ info }: { info: LockoutInfo }) {
  const isSuspended = info.status === "SUSPENDED";
  const suspendedDaysAgo = Math.abs(info.daysRemaining);

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100">
          <Lock className="h-10 w-10 text-rose-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">
          {isSuspended ? "Service Suspended" : "Subscription Expired"}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Your guesthouse management service has been{" "}
          {isSuspended ? "suspended due to unpaid subscription." : "expired and is in the grace period."}
          Please contact the administrator to renew your subscription.
        </p>

        {/* Downtime Counter */}
        <Card className={`mt-6 mx-auto border ${isSuspended ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Clock className={`h-5 w-5 ${isSuspended ? "text-rose-600" : "text-amber-600"}`} />
              {isSuspended ? (
                <p className="font-semibold text-rose-800">
                  Suspended for <span className="text-lg">{suspendedDaysAgo}</span> day{suspendedDaysAgo !== 1 ? "s" : ""}
                </p>
              ) : (
                <p className="font-semibold text-amber-800">
                  Grace period: <span className="text-lg">{Math.abs(info.daysRemaining)}</span> day{Math.abs(info.daysRemaining) !== 1 ? "s" : ""} remaining
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Provider Info */}
        <Card className="mt-4 mx-auto max-w-sm">
          <CardContent className="p-4">
            <div className="grid gap-2 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Guesthouse:</span>
                <span className="font-medium text-slate-900">{info.providerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Owner:</span>
                <span className="font-medium text-slate-900">{info.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cycle:</span>
                <span className="font-medium text-slate-900">{info.cycle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Due:</span>
                <span className="font-bold text-rose-700">
                  {info.price > 0 ? `${info.price.toLocaleString()} ETB` : "Contact admin"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expired:</span>
                <span className="font-medium text-slate-900">
                  {new Date(info.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Phone className="h-4 w-4 text-slate-400" />
          <p className="text-sm text-slate-500">
            Contact your administrator to renew: <strong>{info.phone || "system admin"}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
