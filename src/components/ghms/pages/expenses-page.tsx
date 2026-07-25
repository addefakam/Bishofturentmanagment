"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetExpenses,
  apiCreateExpense,
  apiUpdateExpense,
  apiDeleteExpense,
  apiGetExpenseCategories,
  apiCreateExpenseCategory,
  apiDeleteExpenseCategory,
} from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Receipt,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  DollarSign,
  CalendarDays,
  Tag,
  TrendingDown,
  FolderPlus,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string;
  paymentMethod: string;
  receiptNo: string;
  taxAmount: number;
}

interface Category {
  id: string;
  name: string;
  nameAm: string;
  color: string;
  icon: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(price);

const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "MOBILE"] as const;

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6", "#f43f5e",
];

const CATEGORY_PRESETS: { name: string; color: string; icon: string }[] = [
  { name: "Utilities", color: "#3b82f6", icon: "⚡" },
  { name: "Supplies", color: "#f97316", icon: "📦" },
  { name: "Maintenance", color: "#ef4444", icon: "🔧" },
  { name: "Salaries", color: "#22c55e", icon: "💰" },
  { name: "Food & Beverage", color: "#eab308", icon: "🍽️" },
  { name: "Laundry", color: "#06b6d4", icon: "🧺" },
  { name: "Marketing", color: "#8b5cf6", icon: "📢" },
  { name: "Transport", color: "#ec4899", icon: "🚗" },
  { name: "Rent", color: "#6366f1", icon: "🏠" },
  { name: "Insurance", color: "#14b8a6", icon: "🛡️" },
  { name: "Miscellaneous", color: "#f43f5e", icon: "📋" },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { refreshKey, triggerRefresh } = useAppStore();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCatMgmt, setShowCatMgmt] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSaving, setNewCatSaving] = useState(false);

  // Expense dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
    amount: "",
    vendor: "",
    paymentMethod: "CASH",
    receiptNo: "",
    taxAmount: "0",
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteCatTarget, setDeleteCatTarget] = useState<Category | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [expData, catData] = await Promise.all([
        apiGetExpenses(),
        apiGetExpenseCategories(),
      ]);
      setExpenses(expData.expenses || []);
      setCategories(catData.categories || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const filteredExpenses = useMemo(() => {
    if (categoryFilter === "all") return expenses;
    return expenses.filter((e) => e.category === categoryFilter);
  }, [expenses, categoryFilter]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const thisMonthTotal = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return expenses.filter((e) => e.date.startsWith(ym)).reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const topCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0] : ["None", 0];
  }, [expenses]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    const maxVal = Math.max(...Object.values(map), 1);
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({
        category: cat,
        amount: val,
        percent: (val / maxVal) * 100,
        color: categories.find((c) => c.name === cat)?.color || DEFAULT_COLORS[Object.keys(map).indexOf(cat) % DEFAULT_COLORS.length],
      }));
  }, [filteredExpenses, categories]);

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().split("T")[0],
      category: categories[0]?.name || "",
      description: "",
      amount: "",
      vendor: "",
      paymentMethod: "CASH",
      receiptNo: "",
      taxAmount: "0",
    });
    setDialogOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setForm({
      date: exp.date,
      category: exp.category,
      description: exp.description,
      amount: String(exp.amount),
      vendor: exp.vendor,
      paymentMethod: exp.paymentMethod,
      receiptNo: exp.receiptNo,
      taxAmount: String(exp.taxAmount),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.date || !form.category || !form.description || !form.amount || !form.paymentMethod) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        date: form.date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        vendor: form.vendor,
        paymentMethod: form.paymentMethod,
        receiptNo: form.receiptNo,
        taxAmount: Number(form.taxAmount) || 0,
      };
      if (editing) {
        await apiUpdateExpense(editing.id, payload);
        toast.success("Expense updated");
      } else {
        await apiCreateExpense(payload);
        toast.success("Expense created");
      }
      setDialogOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiDeleteExpense(deleteTarget.id);
      toast.success("Expense deleted");
      setDeleteTarget(null);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const preset = CATEGORY_PRESETS.find((p) => p.name.toLowerCase() === newCatName.trim().toLowerCase());
    try {
      setNewCatSaving(true);
      await apiCreateExpenseCategory({
        name: newCatName.trim(),
        nameAm: "",
        color: preset?.color || DEFAULT_COLORS[categories.length % DEFAULT_COLORS.length],
        icon: preset?.icon || "📋",
      });
      toast.success("Category added");
      setNewCatName("");
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add category");
    } finally {
      setNewCatSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    try {
      await apiDeleteExpenseCategory(deleteCatTarget.id);
      toast.success("Category deleted");
      setDeleteCatTarget(null);
      if (categoryFilter === deleteCatTarget.name) setCategoryFilter("all");
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  const getCategoryColor = (name: string) =>
    categories.find((c) => c.name === name)?.color || "#6b7280";

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div><Skeleton className="h-8 w-40" /><Skeleton className="mt-1 h-4 w-56" /></div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-1 text-sm text-gray-500">Track and manage all business expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCatMgmt(!showCatMgmt)} className="gap-2">
            <FolderPlus className="h-4 w-4" />
            {showCatMgmt ? "Hide Categories" : "Manage Categories"}
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Expenses</p>
                <p className="text-xl font-bold text-gray-900">{formatPrice(totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50">
                <CalendarDays className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">This Month</p>
                <p className="text-xl font-bold text-gray-900">{formatPrice(thisMonthTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-50">
                <TrendingDown className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Top Category</p>
                <p className="text-xl font-bold text-gray-900">{topCategory[0]}</p>
                <p className="text-xs text-gray-400">{formatPrice(topCategory[1] as number)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Management */}
      {showCatMgmt && (
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4" /> Expense Categories
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => (
                <Badge
                  key={cat.id}
                  variant="outline"
                  className="cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors gap-1"
                  onClick={() => setDeleteCatTarget(cat)}
                >
                  <span>{cat.icon}</span>
                  {cat.name}
                  <span className="ml-1 text-gray-400 text-xs hover:text-red-500">×</span>
                </Badge>
              ))}
            </div>
            <Separator className="mb-3" />
            <div className="flex gap-2">
              <Input
                placeholder="New category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                className="max-w-xs"
              />
              <Button onClick={handleAddCategory} disabled={!newCatName.trim() || newCatSaving} size="sm">
                {newCatSaving ? "Adding..." : "Add"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Filter:</span>
        <Button
          variant={categoryFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={categoryFilter === cat.name ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(cat.name)}
            className="gap-1"
          >
            <span>{cat.icon}</span>
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Breakdown Visualization */}
      {categoryBreakdown.length > 0 && (
        <Card className="gap-0 py-0">
          <CardContent className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="flex items-center gap-3">
                  <div className="w-28 text-sm text-gray-600 truncate shrink-0">{item.category}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 flex items-center pl-2"
                      style={{ width: `${item.percent}%`, backgroundColor: item.color, minWidth: item.percent > 0 ? "2rem" : "0" }}
                    >
                      {item.percent > 15 && (
                        <span className="text-xs font-medium text-white truncate">
                          {formatPrice(item.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                  {item.percent <= 15 && (
                    <span className="text-xs text-gray-500 w-20 text-right">{formatPrice(item.amount)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Receipt className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-lg font-medium text-gray-500">No expenses found</p>
          <p className="mt-1 text-sm text-gray-400">
            {categoryFilter !== "all" ? "Try a different category filter" : "Start by adding your first expense"}
          </p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
            <Plus className="h-4 w-4" /> Add Expense
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell className="text-sm">{exp.date}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="gap-1"
                        style={{
                          borderColor: getCategoryColor(exp.category),
                          color: getCategoryColor(exp.category),
                          backgroundColor: getCategoryColor(exp.category) + "15",
                        }}
                      >
                        {categories.find((c) => c.name === exp.category)?.icon || "📋"}
                        {exp.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-sm text-gray-900 truncate">{exp.description}</p>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatPrice(exp.amount)}
                      {exp.taxAmount > 0 && (
                        <span className="text-xs text-gray-400 block">+{formatPrice(exp.taxAmount)} tax</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{exp.vendor || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{exp.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{exp.receiptNo || "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(exp)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => setDeleteTarget(exp)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ─── Create/Edit Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Add New Expense"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update expense details." : "Record a new business expense."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category <span className="text-rose-500">*</span></Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        <span className="flex items-center gap-1.5">
                          <span>{cat.icon}</span> {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-rose-500">*</span></Label>
              <Input placeholder="What was this expense for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount <span className="text-rose-500">*</span></Label>
                <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tax Amount</Label>
                <Input type="number" placeholder="0" value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input placeholder="Vendor name" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method <span className="text-rose-500">*</span></Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Receipt Number</Label>
              <Input placeholder="Receipt or reference number" value={form.receiptNo} onChange={(e) => setForm({ ...form, receiptNo: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Expense" : "Create Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Expense Alert ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the expense for &quot;{deleteTarget?.description}&quot; ({formatPrice(deleteTarget?.amount || 0)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Category Alert ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteCatTarget} onOpenChange={() => setDeleteCatTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category &quot;{deleteCatTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this category. Existing expenses with this category will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDeleteCategory}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}