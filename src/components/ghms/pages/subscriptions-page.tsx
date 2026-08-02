"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  History,
  Loader2,
  Phone,
  CalendarDays,
  Filter,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import {
  formatCycle,
  formatDaysRemaining,
  getStatusBadgeClasses,
  CYCLE_DAYS,
  type SubscriptionStatus,
} from "@/lib/subscription";
import {
  apiGetSubscriptions,
  apiUpdateSubscription,
  apiMarkPayment,
  apiGetSubscriptionPayments,
  apiGetPlans,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface SubRow {
  providerId: string;
  providerName: string;
  ownerName: string;
  phone: string;
  email: string;
  subscriptionId: string;
  cycle: string;
  price: number;
  planId: string | null;
  planName: string | null;
  status: SubscriptionStatus;
  daysRemaining: number;
  startDate: string;
  endDate: string;
  totalPayments: number;
}

interface PlanOption {
  id: string;
  name: string;
  cycle: string;
  price: number;
  isActive: boolean;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [plans, setPlans] = useState<PlanOption[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<SubRow | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editCycle, setEditCycle] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Payment dialog
  const [payOpen, setPayOpen] = useState(false);
  const [payRow, setPayRow] = useState<SubRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payCycle, setPayCycle] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payPlanId, setPayPlanId] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySubId, setHistorySubId] = useState("");
  const [historyProviderName, setHistoryProviderName] = useState("");
  const [payments, setPayments] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const filterParam = statusFilter === "ALL" ? undefined : statusFilter;
      const data = await apiGetSubscriptions(filterParam);
      setSubscriptions(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await apiGetPlans();
      setPlans(data.filter((p: PlanOption) => p.isActive));
    } catch {
      // Non-critical — plans are optional for the payment flow
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
    fetchPlans();
  }, [fetchSubscriptions, fetchPlans]);

  // Summary counts
  const counts = {
    active: subscriptions.filter((s) => s.status === "ACTIVE").length,
    warning: subscriptions.filter((s) => s.status === "WARNING").length,
    grace: subscriptions.filter((s) => s.status === "GRACE").length,
    suspended: subscriptions.filter((s) => s.status === "SUSPENDED").length,
    total: subscriptions.length,
  };

  // ── Edit handlers ──
  function openEdit(row: SubRow) {
    setEditRow(row);
    setEditPrice(String(row.price));
    setEditCycle(row.cycle);
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editRow || !editPrice.trim()) return;
    setEditSaving(true);
    try {
      await apiUpdateSubscription(editRow.subscriptionId, {
        price: parseFloat(editPrice),
        cycle: editCycle,
      });
      toast.success(`Updated subscription for ${editRow.providerName}`);
      setEditOpen(false);
      fetchSubscriptions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Payment handlers ──
  function openPay(row: SubRow) {
    setPayRow(row);
    setPayAmount(String(row.price || ""));
    setPayCycle(row.cycle);
    setPayNotes("");
    setPayPlanId("");
    setPayOpen(true);
  }

  // When a plan is selected in the payment dialog, auto-fill amount and cycle
  function handlePayPlanChange(planId: string) {
    setPayPlanId(planId);
    if (planId) {
      const plan = plans.find((p) => p.id === planId);
      if (plan) {
        setPayAmount(String(plan.price));
        setPayCycle(plan.cycle);
      }
    }
  }

  async function handlePaymentConfirm() {
    if (!payRow || !payAmount.trim()) return;
    setPaySaving(true);
    try {
      const payload: Record<string, unknown> = {
        amount: parseFloat(payAmount),
        cycle: payCycle,
        notes: payNotes,
      };
      if (payPlanId) {
        payload.planId = payPlanId;
      }
      await apiMarkPayment(payRow.subscriptionId, payload);
      toast.success(`Payment recorded for ${payRow.providerName}`);
      setPayOpen(false);
      fetchSubscriptions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setPaySaving(false);
    }
  }

  // ── History handler ──
  async function openHistory(row: SubRow) {
    setHistorySubId(row.subscriptionId);
    setHistoryProviderName(row.providerName);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const data = await apiGetSubscriptionPayments(row.subscriptionId);
      setPayments(data);
    } catch {
      toast.error("Failed to load payment history");
    } finally {
      setHistoryLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary/60" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            Subscriptions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage provider subscriptions, payments, and service access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="WARNING">Warning (Expiring)</SelectItem>
              <SelectItem value="GRACE">Grace Period</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchSubscriptions} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200">
          <CardContent className="p-3">
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Active
            </p>
            <p className="text-2xl font-bold text-emerald-700">{counts.active}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="p-3">
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Warning
            </p>
            <p className="text-2xl font-bold text-amber-700">{counts.warning}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200">
          <CardContent className="p-3">
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Grace
            </p>
            <p className="text-2xl font-bold text-rose-700">{counts.grace}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-300">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Suspended
            </p>
            <p className="text-2xl font-bold text-slate-700">{counts.suspended}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Provider</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Owner</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Phone</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Plan</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Cycle</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Price</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Ends</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Payments</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No providers found.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map((row) => (
                    <tr
                      key={row.subscriptionId}
                      className={`border-b hover:bg-slate-50 ${
                        row.status === "SUSPENDED" ? "bg-slate-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {row.providerName}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{row.ownerName}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {row.phone}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.planName ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700"
                          >
                            <Tag className="mr-1 size-3" />
                            {row.planName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">No plan</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {formatCycle(row.cycle)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900">
                        {row.price > 0 ? `${row.price.toLocaleString()} ETB` : "Trial"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${getStatusBadgeClasses(row.status)}`}
                        >
                          {row.status}
                        </Badge>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatDaysRemaining(row.daysRemaining)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        <span className="inline-flex items-center gap-1 text-[12px]">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(row.endDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.totalPayments}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openHistory(row)}
                            title="Payment history"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(row)}
                            title="Edit price/cycle"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-700"
                            onClick={() => openPay(row)}
                            title="Mark payment"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Edit Price/Cycle Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Update price and billing cycle for <strong>{editRow?.providerName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Price per Cycle (ETB)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="Enter price"
              />
            </div>
            <div className="grid gap-2">
              <Label>Billing Cycle</Label>
              <Select value={editCycle} onValueChange={setEditCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly (30 days)</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly (90 days)</SelectItem>
                  <SelectItem value="SEMI_ANNUAL">Semi-Annual (180 days)</SelectItem>
                  <SelectItem value="YEARLY">Yearly (365 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark Payment Dialog ── */}
      <AlertDialog open={payOpen} onOpenChange={setPayOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Record Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm payment for <strong>{payRow?.providerName}</strong>.
              This will extend their subscription by one{" "}
              <strong>{payRow ? formatCycle(payCycle || payRow.cycle) : ""}</strong> cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-2">
            {/* Plan selector */}
            {plans.length > 0 && (
              <div className="grid gap-2">
                <Label>Select Plan (optional)</Label>
                <Select value={payPlanId} onValueChange={handlePayPlanChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a plan to auto-fill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No plan (manual entry)</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {plan.price.toLocaleString()} ETB ({formatCycle(plan.cycle)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Amount (ETB)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Payment amount"
              />
            </div>
            <div className="grid gap-2">
              <Label>Cycle</Label>
              <Select value={payCycle} onValueChange={setPayCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly (30 days)</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly (90 days)</SelectItem>
                  <SelectItem value="SEMI_ANNUAL">Semi-Annual (180 days)</SelectItem>
                  <SelectItem value="YEARLY">Yearly (365 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notes (optional)</Label>
              <Input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="e.g., Cash payment received"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={paySaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePaymentConfirm}
              disabled={paySaving || !payAmount.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {paySaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Confirm Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Payment History Dialog ── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              All payments for <strong>{historyProviderName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No payments recorded.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {p.amount.toLocaleString()} ETB
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatCycle(p.cycle)} &middot;{" "}
                          {new Date(p.periodStart).toLocaleDateString()} →{" "}
                          {new Date(p.periodEnd).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                          Paid
                        </Badge>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {p.notes && (
                      <p className="mt-1.5 text-xs text-slate-500 italic">{p.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
