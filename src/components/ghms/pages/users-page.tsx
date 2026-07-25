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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, Users } from "lucide-react";

const PERMISSION_OPTIONS = [
  { value: "reservations", label: "Reservations" },
  { value: "guests", label: "Guests" },
  { value: "rooms", label: "Rooms" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "daytime", label: "Daytime Services" },
];

const ROLE_COLORS: Record<string, string> = {
  SUPERUSER: "bg-purple-100 text-purple-700 border-purple-200",
  OPERATOR: "bg-blue-100 text-blue-700 border-blue-200",
  STAFF: "bg-green-100 text-green-700 border-green-200",
  POLICE: "bg-red-100 text-red-700 border-red-200",
};

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  permissions: string;
  providerId: string | null;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  username: "",
  password: "",
  name: "",
  role: "STAFF",
  permissions: [] as string[],
};

export default function UsersPage() {
  const { refreshKey, currentUser } = useAppStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const visibleUsers = users.filter(
    (u) => currentUser?.role !== "OPERATOR" || u.role === "STAFF"
  );

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetUsers();
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    let perms: string[] = [];
    try {
      perms = user.permissions ? JSON.parse(user.permissions) : [];
    } catch {
      perms = [];
    }
    setForm({
      username: user.username,
      password: "",
      name: user.name,
      role: user.role,
      permissions: perms,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.name.trim() || !form.role) {
      toast.error("Username, name, and role are required");
      return;
    }
    if (!editingUser && !form.password) {
      toast.error("Password is required for new users");
      return;
    }

    setSaving(true);
    try {
      const targetRole = currentUser?.role === "OPERATOR" ? "STAFF" : form.role;
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        name: form.name.trim(),
        role: targetRole,
      };
      if (targetRole === "STAFF") {
        payload.permissions = form.permissions;
      } else {
        payload.permissions = [];
      }
      if (form.password) payload.password = form.password;

      if (editingUser) {
        await apiUpdateUser(editingUser.id, payload);
        toast.success("User updated");
      } else {
        await apiCreateUser(payload);
        toast.success("User created");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save user";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDeleteUser(deleteTarget.id);
      toast.success("User deleted");
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const togglePermission = (perm: string) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, roles, and permissions.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">No users found</p>
            <p className="text-sm">Create a user to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleUsers.map((user) => {
                  let perms: string[] = [];
                  try {
                    perms = user.permissions ? JSON.parse(user.permissions) : [];
                  } catch {
                    perms = [];
                  }
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ROLE_COLORS[user.role] || ""}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.providerId ? user.providerId.slice(0, 8) + "..." : "—"}
                      </TableCell>
                      <TableCell>
                        {user.role === "STAFF" ? (
                          <div className="flex flex-wrap gap-1">
                            {perms.length > 0 ? (
                              perms.map((p) => (
                                <Badge key={p} variant="secondary" className="text-xs">
                                  {p}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">All access</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(user)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user details. Leave password blank to keep unchanged."
                : "Create a new user account."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="Enter username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">
                Password {editingUser && <span className="text-muted-foreground">(optional)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            {currentUser?.role === "SUPERUSER" ? (
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPERATOR">Operator</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Role</Label>
                <div className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm items-center text-muted-foreground">
                  Staff
                </div>
              </div>
            )}
            {form.role === "STAFF" && (
              <div className="grid gap-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label
                      key={perm.value}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={form.permissions.includes(perm.value)}
                        onCheckedChange={() => togglePermission(perm.value)}
                      />
                      {perm.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingUser ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}