"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetUsers,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  Plus,
  Pencil,
  Trash2,
  UserCog,
  Users,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  CalendarCheck,
  Sun,
  Sparkles,
  Bed,
  BarChart3,
  Star,
  Bell,
  Settings,
  Search,
  ChevronRight,
  KeyRound,
} from "lucide-react";

// ── Permission options that OPERATOR can assign to staff ──
const PERMISSION_OPTIONS = [
  { value: "reservations", label: "Reservations", icon: CalendarCheck, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "guests", label: "Guests", icon: Users, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "rooms", label: "Rooms", icon: Bed, color: "text-violet-600 bg-violet-50 border-violet-200" },
  { value: "housekeeping", label: "Housekeeping", icon: Sparkles, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "daytime", label: "Daytime Services", icon: Sun, color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "reports", label: "Reports", icon: BarChart3, color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  { value: "reviews", label: "Reviews", icon: Star, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  { value: "notifications", label: "Notifications", icon: Bell, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { value: "settings", label: "Settings", icon: Settings, color: "text-slate-600 bg-slate-50 border-slate-200" },
];

// Helper to get permission display info
const PERM_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {};
PERMISSION_OPTIONS.forEach((p) => {
  PERM_MAP[p.value] = { label: p.label, icon: p.icon, color: p.color };
});

interface StaffUser {
  id: string;
  username: string;
  name: string;
  role: string;
  permissions: string;
  providerId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  username: "",
  password: "",
  name: "",
  permissions: ["reservations", "guests"] as string[],
};

export default function UsersPage() {
  const { refreshKey, currentUser } = useAppStore();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Reset credentials dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetUsers();
      setStaff(data as StaffUser[]);
    } catch {
      toast.error("Failed to load staff accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff, refreshKey]);

  // Filter staff by search
  const filteredStaff = staff.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  // ── Parse permissions helper ──
  const parsePerms = (permissions: string): string[] => {
    try {
      return permissions ? JSON.parse(permissions) : [];
    } catch {
      return [];
    }
  };

  // ── Open create dialog ──
  const openCreate = () => {
    setEditingUser(null);
    setForm({ ...emptyForm });
    setShowPassword(false);
    setDialogOpen(true);
  };

  // ── Open edit dialog ──
  const openEdit = (user: StaffUser) => {
    setEditingUser(user);
    const perms = parsePerms(user.permissions);
    setForm({
      username: user.username,
      password: "",
      name: user.name,
      permissions: perms,
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  // ── Open reset credentials dialog ──
  const openReset = (user: StaffUser) => {
    setResetTarget(user);
    setResetUsername(user.username);
    setResetPassword("");
    setShowResetPassword(false);
    setResetOpen(true);
  };

  // ── Toggle permission in form ──
  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  // ── Save (create or update) ──
  const handleSave = async () => {
    if (!form.username.trim() || !form.name.trim()) {
      toast.error("Username and name are required");
      return;
    }
    if (!editingUser && !form.password) {
      toast.error("Password is required for new staff accounts");
      return;
    }
    if (form.permissions.length === 0) {
      toast.error("Select at least one permission/right for the staff account");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        name: form.name.trim(),
        role: "STAFF",
        permissions: form.permissions,
      };
      if (form.password) payload.password = form.password;

      if (editingUser) {
        await apiUpdateUser(editingUser.id, payload);
        toast.success("Staff account updated successfully");
      } else {
        await apiCreateUser(payload);
        toast.success("Staff account created successfully");
      }
      setDialogOpen(false);
      fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save staff account";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset credentials ──
  const handleReset = async () => {
    if (!resetTarget) return;
    if (!resetUsername.trim()) {
      toast.error("Username is required");
      return;
    }
    setResetSaving(true);
    try {
      const payload: Record<string, unknown> = { username: resetUsername.trim() };
      if (resetPassword.trim()) payload.password = resetPassword.trim();
      await apiUpdateUser(resetTarget.id, payload);
      toast.success("Credentials updated successfully");
      setResetOpen(false);
      fetchStaff();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update credentials";
      toast.error(msg);
    } finally {
      setResetSaving(false);
    }
  };

  // ── Delete staff ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDeleteUser(deleteTarget.id);
      toast.success("Staff account deleted successfully");
      setDeleteTarget(null);
      fetchStaff();
    } catch {
      toast.error("Failed to delete staff account");
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage staff accounts you created. Each staff member has access only to the rights you assign.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Staff List ── */}
      {filteredStaff.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <UserCog className="mb-4 h-12 w-12 opacity-30" />
          <p className="font-medium text-lg">
            {search ? "No matching staff" : "No staff accounts yet"}
          </p>
          <p className="text-sm mt-1">
            {search
              ? "Try adjusting your search terms."
              : "Click \"Add Staff\" to create your first staff account."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStaff.map((user) => {
            const perms = parsePerms(user.permissions);
            return (
              <div
                key={user.id}
                className="rounded-lg border p-4 hover:bg-muted/30 transition-colors"
              >
                {/* Staff header row */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100">
                    <Users className="h-5 w-5 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{user.name}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5 bg-sky-100 text-sky-700 border-sky-200">
                        Staff
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{user.username}</code>
                      <span className="ml-2">Created {new Date(user.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(user)}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openReset(user)}>
                      <KeyRound className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Reset</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-red-600 hover:text-red-700"
                      onClick={() => setDeleteTarget(user)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Rights/Permissions section */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Assigned Rights</p>
                  <div className="flex flex-wrap gap-1.5">
                    {perms.length > 0 ? (
                      perms.map((p) => {
                        const info = PERM_MAP[p];
                        if (!info) return null;
                        const Icon = info.icon;
                        return (
                          <Badge
                            key={p}
                            variant="outline"
                            className={`text-xs gap-1 ${info.color}`}
                          >
                            <Icon className="h-3 w-3" />
                            {info.label}
                          </Badge>
                        );
                      })
                    ) : (
                      <span className="text-xs text-muted-foreground">No rights assigned</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Staff Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              {editingUser ? "Edit Staff Account" : "Add New Staff"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update staff details and their access rights. Leave password blank to keep unchanged."
                : "Create a new staff account and assign their access rights."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Username */}
            {!editingUser && (
              <div className="grid gap-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. staff-abebe"
                  autoFocus
                />
              </div>
            )}

            {/* Password */}
            <div className="grid gap-2">
              <Label htmlFor="password">
                {editingUser ? "New Password" : "Password *"}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Abebe Kebede"
              />
            </div>

            {/* Rights/Permissions */}
            <div className="grid gap-2">
              <Label>Access Rights *</Label>
              <p className="text-xs text-muted-foreground">
                Select which pages and features this staff member can access.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {PERMISSION_OPTIONS.map((perm) => {
                  const Icon = perm.icon;
                  const isChecked = form.permissions.includes(perm.value);
                  return (
                    <label
                      key={perm.value}
                      className={`flex items-center gap-2 text-sm cursor-pointer rounded-md border px-3 py-2 transition-colors ${isChecked ? perm.color + " border-current" : "border-transparent hover:bg-muted/50"}`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => togglePermission(perm.value)}
                      />
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {perm.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingUser ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <UserCog className="h-4 w-4" />
                  {editingUser ? "Update Staff" : "Create Staff"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Credentials Dialog ── */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Reset Credentials
            </DialogTitle>
            <DialogDescription>
              Update login credentials for <strong>{resetTarget?.name}</strong>. Leave password blank to keep current password unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="reset-username">Username *</Label>
              <Input
                id="reset-username"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                placeholder="Enter new username"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-password">New Password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showResetPassword ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={resetSaving} className="gap-2">
              {resetSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  Save Credentials
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Staff Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.username})?
              This action cannot be undone. They will lose all access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90 gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Staff
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
