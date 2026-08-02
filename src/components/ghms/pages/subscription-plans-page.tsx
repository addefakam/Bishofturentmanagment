"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Calendar,
  RefreshCw,
  Sparkles,
  BadgeCheck,
  Save,
  X,
  Tag,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { CYCLE_DAYS, formatCycle } from "@/lib/subscription";
import { apiGetPlans, apiCreatePlan, apiUpdatePlan, apiDeletePlan } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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

interface Plan {
  id: string;
  name: string;
  cycle: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  days: number;
  months: number;
  perMonth: number;
  subscriptionCount: number;
}

// Cycle color themes for card headers
const CYCLE_GRADIENT: Record<string, string> = {
  MONTHLY: "from-emerald-500 to-teal-600",
  QUARTERLY: "from-amber-500 to-orange-600",
  SEMI_ANNUAL: "from-violet-500 to-purple-600",
  YEARLY: "from-rose-500 to-pink-600",
};

const CYCLE_BG: Record<string, string> = {
  MONTHLY: "from-emerald-50 to-teal-50",
  QUARTERLY: "from-amber-50 to-orange-50",
  SEMI_ANNUAL: "from-violet-50 to-purple-50",
  YEARLY: "from-rose-50 to-pink-50",
};

const CYCLE_ICON_BG: Record<string, string> = {
  MONTHLY: "bg-emerald-100 text-emerald-700",
  QUARTERLY: "bg-amber-100 text-amber-700",
  SEMI_ANNUAL: "bg-violet-100 text-violet-700",
  YEARLY: "bg-rose-100 text-rose-700",
};

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formName, setFormName] = useState("");
  const [formCycle, setFormCycle] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePlan, setDeletePlan] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGetPlans();
      setPlans(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // ── Create / Edit ──
  function openCreate() {
    setEditingPlan(null);
    setFormName("");
    setFormCycle("");
    setFormPrice("");
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormCycle(plan.cycle);
    setFormPrice(String(plan.price));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCycle || !formPrice.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSaving(true);
    try {
      if (editingPlan) {
        await apiUpdatePlan(editingPlan.id, {
          name: formName.trim(),
          cycle: formCycle,
          price: parseFloat(formPrice),
        });
        toast.success(`Plan "${formName.trim()}" updated`);
      } else {
        await apiCreatePlan({
          name: formName.trim(),
          cycle: formCycle,
          price: parseFloat(formPrice),
        });
        toast.success(`Plan "${formName.trim()}" created`);
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ──
  async function handleToggleActive(plan: Plan) {
    try {
      await apiUpdatePlan(plan.id, { isActive: !plan.isActive });
      toast.success(plan.isActive ? `Plan "${plan.name}" deactivated` : `Plan "${plan.name}" activated`);
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle plan");
    }
  }

  // ── Delete ──
  function openDelete(plan: Plan) {
    setDeletePlan(plan);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deletePlan) return;
    setDeleting(true);
    try {
      await apiDeletePlan(deletePlan.id);
      toast.success(`Plan "${deletePlan.name}" deleted`);
      setDeleteOpen(false);
      fetchPlans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete plan");
    } finally {
      setDeleting(false);
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
            <Tag className="h-6 w-6 text-emerald-600" />
            Pricing Plans
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Define and manage subscription pricing plans for guest house providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={fetchPlans} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" />
            Create Plan
          </Button>
        </div>
      </div>

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <CreditCard className="size-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No Plans Yet</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md">
              Create your first pricing plan to define subscription tiers for guest house providers.
            </p>
            <Button onClick={openCreate} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              Create First Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative overflow-hidden border transition-shadow hover:shadow-lg ${
                !plan.isActive ? "opacity-60" : ""
              }`}
            >
              {/* Gradient header accent */}
              <div
                className={`h-2 bg-gradient-to-r ${
                  CYCLE_GRADIENT[plan.cycle] || "from-slate-400 to-slate-500"
                }`}
              />

              <CardHeader className="pb-3 pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        CYCLE_ICON_BG[plan.cycle] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        {plan.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {formatCycle(plan.cycle)} &middot; {plan.days} days
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {plan.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700"
                      >
                        <Check className="mr-1 size-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500"
                      >
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Price */}
                <div className={`rounded-xl bg-gradient-to-br p-4 ${CYCLE_BG[plan.cycle] || "from-slate-50 to-slate-100"}`}>
                  <p className="text-xs font-medium text-slate-500">Price</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {plan.price.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">ETB</span>
                  </div>
                  {plan.months > 1 && (
                    <p className="mt-1 text-xs text-slate-500">
                      <Sparkles className="mr-1 inline-block size-3 text-amber-500" />
                      ~{plan.perMonth.toLocaleString()} ETB / month
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-slate-400" />
                    <span className="font-medium">{plan.subscriptionCount}</span>
                    <span className="text-xs text-slate-400">providers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-slate-400" />
                    <span className="text-xs text-slate-400">{plan.days}d cycle</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Label htmlFor={`toggle-${plan.id}`} className="text-xs text-slate-500 cursor-pointer">
                      {plan.isActive ? "Active" : "Inactive"}
                    </Label>
                    <Switch
                      id={`toggle-${plan.id}`}
                      checked={plan.isActive}
                      onCheckedChange={() => handleToggleActive(plan)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-slate-500 hover:text-slate-700"
                    onClick={() => openEdit(plan)}
                    title="Edit plan"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => openDelete(plan)}
                    title="Delete plan"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Edit Plan" : "Create New Plan"}
            </DialogTitle>
            <DialogDescription>
              {editingPlan
                ? `Update the pricing details for "${editingPlan.name}".`
                : "Define a new subscription pricing plan for providers."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Plan Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Monthly, Quarterly, Premium Annual"
              />
            </div>
            <div className="grid gap-2">
              <Label>Billing Cycle</Label>
              <Select value={formCycle} onValueChange={setFormCycle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cycle" />
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
              <Label>Price (ETB)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                placeholder="Enter price in ETB"
              />
              {formCycle && formPrice && Number(formPrice) >= 0 && (
                <p className="text-xs text-slate-500">
                  {formatCycle(formCycle)} &middot;{" "}
                  {CYCLE_DAYS[formCycle] || 30} days &middot;{" "}
                  ~{(Number(formPrice) / ((CYCLE_DAYS[formCycle] || 30) / 30)).toFixed(2)} ETB/month
                </p>
              )}
            </div>
            {editingPlan && (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">Plan Info</p>
                <p className="mt-1 text-xs text-slate-500">
                  <Users className="mr-1 inline-block size-3" />
                  {editingPlan.subscriptionCount} provider(s) currently on this plan
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formCycle || !formPrice.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePlan && deletePlan.subscriptionCount > 0 ? (
                <>
                  The plan <strong>&quot;{deletePlan.name}&quot;</strong> has{" "}
                  <strong>{deletePlan.subscriptionCount} provider(s)</strong> subscribed to it.
                  It will be <strong>deactivated</strong> instead of permanently deleted.
                </>
              ) : (
                <>
                  Are you sure you want to delete{" "}
                  <strong>&quot;{deletePlan?.name}&quot;</strong>? This action cannot be
                  undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {deletePlan && deletePlan.subscriptionCount > 0
                ? "Deactivate Plan"
                : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
