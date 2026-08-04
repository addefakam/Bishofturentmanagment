"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Loader2,
  Bed,
  CalendarDays,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Phone,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { apiMyBill } from "@/lib/api";
import { formatCycle, formatDaysRemaining, getStatusBadgeClasses } from "@/lib/subscription";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const PRICE_PER_BED_PER_MONTH = 100; // ETB
const CYCLE_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  YEARLY: 12,
};

interface SubInfo {
  id: string;
  status: string;
  daysRemaining: number;
  startDate: string;
  endDate: string;
  cycle: string;
  price: number;
}

interface Payment {
  id: string;
  amount: number;
  cycle: string;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  createdAt: string;
}

interface BillData {
  providerName: string;
  ownerName: string;
  phone: string;
  totalBeds: number;
  subscription: SubInfo | null;
  payments: Payment[];
  totalPaid: number;
}

export default function MyBillPage() {
  const [data, setData] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBill = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiMyBill();
      setData(result as BillData);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load bill information");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBill();
  }, [fetchBill]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary/60" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-400">Unable to load bill information.</p>
      </div>
    );
  }

  const sub = data.subscription;
  const months = sub ? (CYCLE_MONTHS[sub.cycle] || 1) : 1;
  const currentBill = data.totalBeds * PRICE_PER_BED_PER_MONTH * months;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          My Bill
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track your subscription billing and payment history
        </p>
      </div>

      {/* Provider Info Card */}
      <Card className="border-slate-200">
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Building2 className="h-4 w-4" />
                <span>Guesthouse</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{data.providerName}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Phone className="h-4 w-4" />
                <span>Phone</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{data.phone || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Details Card */}
      <Card className="border-slate-200">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Billing Details
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-1">
                <Bed className="h-3.5 w-3.5" />
                <span>Total Registered Beds</span>
              </div>
              <p className="text-xl font-bold text-blue-900">{data.totalBeds}</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-1">
                <Info className="h-3.5 w-3.5" />
                <span>Rate Per Bed/Month</span>
              </div>
              <p className="text-xl font-bold text-blue-900">{PRICE_PER_BED_PER_MONTH} ETB</p>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 mb-1">
                <Receipt className="h-3.5 w-3.5" />
                <span>Current Bill ({formatCycle(sub?.cycle || "MONTHLY")})</span>
              </div>
              <p className="text-xl font-bold text-emerald-900">{currentBill.toLocaleString()} ETB</p>
            </div>
          </div>

          {/* Calculation breakdown */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">How is my bill calculated?</p>
            <p>
              {data.totalBeds} beds x {PRICE_PER_BED_PER_MONTH} ETB/bed/month x {months} month(s) = <strong className="text-slate-900">{currentBill.toLocaleString()} ETB</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Status Card */}
      {sub && (
        <Card className="border-slate-200">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Subscription Status
              </h2>
              <Badge
                variant="outline"
                className={getStatusBadgeClasses(sub.status as any)}
              >
                {sub.status}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Cycle</p>
                <p className="text-sm font-medium text-slate-900">{formatCycle(sub.cycle)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Time Remaining</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatDaysRemaining(sub.daysRemaining)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Start Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {new Date(sub.startDate).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">End Date</p>
                <p className="text-sm font-medium text-slate-900">
                  {new Date(sub.endDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {(sub.status === "WARNING" || sub.status === "GRACE") && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-800">
                  {sub.status === "WARNING"
                    ? "Your subscription is expiring soon. Please contact the admin to renew."
                    : "Your subscription has expired. Please renew immediately to avoid suspension."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Summary */}
      <Card className="border-slate-200">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment Summary
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-xs text-emerald-600 mb-1">Total Payments Made</p>
              <p className="text-xl font-bold text-emerald-900">{data.totalPaid.toLocaleString()} ETB</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-1">Number of Payments</p>
              <p className="text-xl font-bold text-slate-900">{data.payments.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="border-slate-200">
        <CardContent className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Payment History
          </h2>

          {data.payments.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 mb-3">
                <Receipt className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">No payments recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Payment history will appear here once payments are made</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.payments.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {p.amount.toLocaleString()} ETB
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCycle(p.cycle)} &middot;{" "}
                        {new Date(p.periodStart).toLocaleDateString()} &rarr;{" "}
                        {new Date(p.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Paid
                      </Badge>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(p.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {p.notes && (
                    <p className="mt-1.5 text-xs text-slate-500 italic">
                      {p.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
