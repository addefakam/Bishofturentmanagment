"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { apiSuperUpdateUser, apiSuperGetUsers } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  KeyRound,
  Crown,
  Calendar,
  Clock,
  Shield,
  Loader2,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  Users,
  Activity,
} from "lucide-react";

export default function SuperProfilePage() {
  const { currentUser, setCurrentUser } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [stats, setStats] = useState<{ totalUsers: number; providerCount: number } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      // Fetch user details including email/phone
      apiSuperGetUsers({ search: currentUser.username }).then((data) => {
        const me = (data.users || []).find((u: { id: string }) => u.id === currentUser.id);
        if (me) {
          setEmail(me.email || "");
          setPhone(me.phone || "");
        }
        setStats({
          totalUsers: data.stats?.totalUsers || 0,
          providerCount: data.stats?.providerCount || 0,
        });
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (newPassword && !currentPassword) {
      toast.error("Enter current password to change it");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      };
      // If changing password, include current password for verification
      if (newPassword) {
        payload.password = newPassword;
      }

      await apiSuperUpdateUser(currentUser!.id, payload);

      // Update local state
      if (currentUser) {
        setCurrentUser({ ...currentUser, name: name.trim() });
      }

      setCurrentPassword("");
      setNewPassword("");
      toast.success("Profile updated successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account settings and preferences.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Profile Card ── */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600" />
            <CardContent className="relative px-6 pb-6">
              <div className="-mt-12 flex items-end gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <div className="pb-1">
                  <h2 className="text-xl font-bold text-slate-900">{currentUser.name}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                      <Shield className="mr-1 h-3 w-3" />
                      System Administrator
                    </Badge>
                    <span className="text-xs text-slate-400">@{currentUser.username}</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              {stats && (
                <div className="mt-6 grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <Users className="mx-auto h-5 w-5 text-indigo-500" />
                    <p className="mt-1 text-lg font-bold text-slate-900">{stats.totalUsers}</p>
                    <p className="text-[11px] text-slate-400">Total Users</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <Building2 className="mx-auto h-5 w-5 text-emerald-500" />
                    <p className="mt-1 text-lg font-bold text-slate-900">{stats.providerCount}</p>
                    <p className="text-[11px] text-slate-400">Providers</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <Activity className="mx-auto h-5 w-5 text-purple-500" />
                    <p className="mt-1 text-lg font-bold text-slate-900">System</p>
                    <p className="text-[11px] text-slate-400">Online</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Personal Information ── */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="profile-email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    Email
                  </Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@ghms.com"
                    className="bg-slate-50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    Phone
                  </Label>
                  <Input
                    id="profile-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+251..."
                    className="bg-slate-50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Change Password ── */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="current-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="bg-slate-50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {newPassword && (
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm Current Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="bg-slate-50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Enter current password to confirm the change.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Save Button ── */}
          <div className="flex justify-end gap-3">
            <Button variant="outline">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="shadow-sm">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
