"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { apiUpdateUser, apiUpdateSettings } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  Loader2,
  User,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Phone,
  BadgeCheck,
  UserCog,
  ArrowRight,
  Globe,
  Building2,
  Clock,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// ═══════════════════════════════════════════════════════
// Shared helper
// ═══════════════════════════════════════════════════════

function getInitials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ═══════════════════════════════════════════════════════
// Provider Settings (OPERATOR / STAFF)
// Personal profile + password + link to staff management
// ═══════════════════════════════════════════════════════

function ProviderSettings() {
  const { currentUser, setCurrentUser, triggerRefresh, setCurrentPage } =
    useAppStore();

  // Profile form
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [saving, setSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setUsername(currentUser.username);
    }
  }, [currentUser]);

  const handleProfileSave = async () => {
    if (!currentUser) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (username.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    setSaving(true);
    try {
      await apiUpdateUser(currentUser.id, {
        name: name.trim(),
        username: username.trim(),
      });
      setCurrentUser({
        ...currentUser,
        name: name.trim(),
        username: username.trim(),
      });
      toast.success("Profile updated successfully");
      triggerRefresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentUser) return;
    if (!currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!newPassword) {
      toast.error("New password is required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    setChangingPassword(true);
    try {
      await apiUpdateUser(currentUser.id, {
        password: newPassword,
      });
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to change password";
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const roleLabel =
    currentUser?.role === "OPERATOR" ? "Operator" : "Staff";
  const roleBadgeClass =
    currentUser?.role === "OPERATOR"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div className="flex justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personal account and staff accounts.
          </p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarFallback
                  className="bg-primary/10 text-lg font-bold text-primary"
                >
                  {getInitials(name || "OP")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-slate-900">
                  {name || "Operator"}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`${roleBadgeClass} text-xs font-semibold`}
                  >
                    <Shield className="mr-1 size-3" />
                    {roleLabel}
                  </Badge>
                  {currentUser?.providerName && (
                    <Badge variant="outline" className="text-xs">
                      {currentUser.providerName}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  @{currentUser?.username}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="op-name">
                  <User className="inline mr-1.5 size-3.5" />
                  Full Name
                </Label>
                <Input
                  id="op-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="op-username">
                  <BadgeCheck className="inline mr-1.5 size-3.5" />
                  Username
                </Label>
                <Input
                  id="op-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button onClick={handleProfileSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="op-current-pw">Current Password</Label>
              <div className="relative">
                <Input
                  id="op-current-pw"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="op-new-pw">New Password</Label>
                <div className="relative">
                  <Input
                    id="op-new-pw"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNew ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="op-confirm-pw">Confirm New Password</Label>
                <Input
                  id="op-confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>

            {newPassword &&
              confirmPassword &&
              newPassword !== confirmPassword && (
                <p className="text-xs text-rose-500 font-medium">
                  Passwords do not match
                </p>
              )}

            {newPassword &&
              newPassword.length > 0 &&
              newPassword.length < 6 && (
                <p className="text-xs text-rose-500 font-medium">
                  Password must be at least 6 characters
                </p>
              )}

            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                onClick={handlePasswordChange}
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {changingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Staff Account Management (OPERATOR only) */}
        {currentUser?.role === "OPERATOR" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Staff Account Management
              </CardTitle>
              <CardDescription>
                Create, edit, and manage staff accounts you have created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setCurrentPage("users")}
              >
                <UserCog className="mr-2 h-4 w-4" />
                Go to Account Management
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUPERUSER Profile Settings
// ═══════════════════════════════════════════════════════

function SuperuserSettings() {
  const { currentUser, setCurrentUser, triggerRefresh } = useAppStore();

  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [appName, setAppName] = useState("GHMS");
  const [defaultCurrency, setDefaultCurrency] = useState("ETB");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [savingSystem, setSavingSystem] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setUsername(currentUser.username);
    }
  }, [currentUser]);

  const handleProfileSave = async () => {
    if (!currentUser) return;
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!username.trim()) { toast.error("Username is required"); return; }
    if (username.length < 3) { toast.error("Username must be at least 3 characters"); return; }

    setSaving(true);
    try {
      const data: Record<string, unknown> = { name: name.trim(), username: username.trim() };
      if (email.trim()) data.email = email.trim();
      if (phone.trim()) data.phone = phone.trim();
      await apiUpdateUser(currentUser.id, data);
      setCurrentUser({ ...currentUser, name: name.trim(), username: username.trim() });
      toast.success("Profile updated successfully");
      triggerRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentUser) return;
    if (!currentPassword) { toast.error("Current password is required"); return; }
    if (!newPassword) { toast.error("New password is required"); return; }
    if (newPassword.length < 6) { toast.error("New password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return; }
    if (currentPassword === newPassword) { toast.error("New password must be different from current password"); return; }

    setChangingPassword(true);
    try {
      await apiUpdateUser(currentUser.id, { password: newPassword });
      toast.success("Password changed successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setShowCurrent(false); setShowNew(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change password";
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSystemSave = async () => {
    setSavingSystem(true);
    try {
      await apiUpdateSettings({ guestHouseName: appName, currency: defaultCurrency, language: defaultLanguage });
      toast.success("System settings saved");
      triggerRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save system settings";
      toast.error(msg);
    } finally {
      setSavingSystem(false);
    }
  };

  return (
    <div className="flex justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your System Admin account and preferences.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your personal details and contact information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                  {getInitials(name || "SA")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-slate-900">{name || "System Admin"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-xs font-semibold">
                    <Shield className="mr-1 size-3" />Superuser
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <BadgeCheck className="mr-1 size-3 text-emerald-500" />System Administrator
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">@{currentUser?.username}</p>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="su-name"><User className="inline mr-1.5 size-3.5" />Full Name</Label>
                <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="su-username"><BadgeCheck className="inline mr-1.5 size-3.5" />Username</Label>
                <Input id="su-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="su-email"><Mail className="inline mr-1.5 size-3.5" />Email Address</Label>
                <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="su-phone"><Phone className="inline mr-1.5 size-3.5" />Phone Number</Label>
                <Input id="su-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251..." />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={handleProfileSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="su-current-pw">Current Password</Label>
              <div className="relative">
                <Input id="su-current-pw" type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" className="pr-10" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="su-new-pw">New Password</Label>
                <div className="relative">
                  <Input id="su-new-pw" type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className="pr-10" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="su-confirm-pw">Confirm New Password</Label>
                <Input id="su-confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
              </div>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-rose-500 font-medium">Passwords do not match</p>
            )}
            {newPassword && newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-xs text-rose-500 font-medium">Password must be at least 6 characters</p>
            )}
            <div className="flex justify-end pt-1">
              <Button variant="outline" onClick={handlePasswordChange} disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}>
                {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Update Password
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />System Preferences</CardTitle>
            <CardDescription>Configure default settings for the entire system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="su-appname"><Building2 className="inline mr-1.5 size-3.5" />Application Name</Label>
              <Input id="su-appname" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="GHMS" />
              <p className="text-xs text-slate-400">Displayed in the sidebar and browser tab.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="su-currency"><Clock className="inline mr-1.5 size-3.5" />Default Currency</Label>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETB">ETB (Birr)</SelectItem>
                    <SelectItem value="USD">USD (Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="su-language"><Globe className="inline mr-1.5 size-3.5" />Default Language</Label>
                <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="am">Amharic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={handleSystemSave} disabled={savingSystem}>
                {savingSystem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save System Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Settings Page — Role Router
// ═══════════════════════════════════════════════════════

export default function SettingsPage() {
  const currentUser = useAppStore((s) => s.currentUser);

  if (currentUser?.role === "SUPERUSER") {
    return <SuperuserSettings />;
  }

  return <ProviderSettings />;
}
