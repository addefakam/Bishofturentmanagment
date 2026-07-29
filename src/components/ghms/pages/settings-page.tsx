"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetSettings,
  apiUpdateSettings,
  apiExportData,
  apiImportData,
  apiUpdateUser,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  Settings,
  Download,
  Upload,
  Save,
  Loader2,
  User,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Building2,
  Globe,
  Clock,
  Camera,
  BadgeCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

// ═══════════════════════════════════════════════════════
// Provider Settings (OPERATOR / STAFF)
// ═══════════════════════════════════════════════════════

interface SettingsData {
  id: string | null;
  guestHouseName: string;
  ownerName: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  taxRate: number;
  language: string;
  checkInTime: string;
  checkOutTime: string;
}

const DEFAULTS: SettingsData = {
  id: null,
  guestHouseName: "Guest House",
  ownerName: "",
  address: "",
  phone: "",
  email: "",
  currency: "ETB",
  taxRate: 0,
  language: "en",
  checkInTime: "14:00",
  checkOutTime: "12:00",
};

function ProviderSettings() {
  const { refreshKey, triggerRefresh } = useAppStore();
  const [settings, setSettings] = useState<SettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetSettings();
      setSettings({
        id: data.id || null,
        guestHouseName: data.guestHouseName ?? DEFAULTS.guestHouseName,
        ownerName: data.ownerName ?? "",
        address: data.address ?? "",
        phone: data.phone ?? "",
        email: data.email ?? "",
        currency: data.currency ?? "ETB",
        taxRate: data.taxRate ?? 0,
        language: data.language ?? "en",
        checkInTime: data.checkInTime ?? "14:00",
        checkOutTime: data.checkOutTime ?? "12:00",
      });
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings, refreshKey]);

  const update = (key: keyof SettingsData, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiUpdateSettings({
        guestHouseName: settings.guestHouseName,
        ownerName: settings.ownerName,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        currency: settings.currency,
        taxRate: settings.taxRate,
        language: settings.language,
        checkInTime: settings.checkInTime,
        checkOutTime: settings.checkOutTime,
      });
      toast.success("Settings saved");
      triggerRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await apiExportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ghms-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Export failed";
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await apiImportData(data);
      toast.success("Data imported successfully");
      triggerRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your guest house preferences.
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Basic information about your guest house.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ghName">Guest House Name</Label>
            <Input
              id="ghName"
              value={settings.guestHouseName}
              onChange={(e) => update("guestHouseName", e.target.value)}
              placeholder="My Guest House"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ownerName">Owner Name</Label>
            <Input
              id="ownerName"
              value={settings.ownerName}
              onChange={(e) => update("ownerName", e.target.value)}
              placeholder="Owner full name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="Street, City, Country"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="+251..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="info@example.com"
              />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={settings.currency}
                onValueChange={(v) => update("currency", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB (Birr)</SelectItem>
                  <SelectItem value="USD">USD (Dollar)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.taxRate}
                onChange={(e) => update("taxRate", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={settings.language}
                onValueChange={(v) => update("language", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="am">አማርኛ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="checkIn">Check-in Time</Label>
              <Input
                id="checkIn"
                type="time"
                value={settings.checkInTime}
                onChange={(e) => update("checkInTime", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="checkOut">Check-out Time</Label>
              <Input
                id="checkOut"
                type="time"
                value={settings.checkOutTime}
                onChange={(e) => update("checkOutTime", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export or import all guest house data as JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export All Data
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import Data
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Export downloads a JSON file with all your data. Importing will merge
            data by upserting records by ID.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUPERUSER Profile Settings
// ═══════════════════════════════════════════════════════

function SuperuserSettings() {
  const { currentUser, setCurrentUser, triggerRefresh } = useAppStore();
  const [loading, setLoading] = useState(false);

  // Profile form
  const [name, setName] = useState(currentUser?.name || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // System settings form
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
      const data: Record<string, unknown> = { name: name.trim(), username: username.trim() };
      if (email.trim()) data.email = email.trim();
      if (phone.trim()) data.phone = phone.trim();

      await apiUpdateUser(currentUser.id, data);

      // Update local session
      setCurrentUser({
        ...currentUser,
        name: name.trim(),
        username: username.trim(),
      });

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
      const msg = err instanceof Error ? err.message : "Failed to change password";
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSystemSave = async () => {
    setSavingSystem(true);
    try {
      await apiUpdateSettings({
        guestHouseName: appName,
        currency: defaultCurrency,
        language: defaultLanguage,
      });
      toast.success("System settings saved");
      triggerRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save system settings";
      toast.error(msg);
    } finally {
      setSavingSystem(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const getInitials = (n: string) =>
    n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">
          Manage your System Admin account and preferences.
        </p>
      </div>

      {/* ── Profile Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal details and contact information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar + Role Badge */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/20">
              <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                {getInitials(name || "SA")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-slate-900">{name || "System Admin"}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="bg-amber-100 text-amber-700 border-amber-200 text-xs font-semibold"
                >
                  <Shield className="mr-1 size-3" />
                  Superuser
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <BadgeCheck className="mr-1 size-3 text-emerald-500" />
                  System Administrator
                </Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                @username: {currentUser?.username}
              </p>
            </div>
          </div>

          <Separator />

          {/* Name & Username */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="su-name">
                <User className="inline mr-1.5 size-3.5" />
                Full Name
              </Label>
              <Input
                id="su-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="su-username">
                <BadgeCheck className="inline mr-1.5 size-3.5" />
                Username
              </Label>
              <Input
                id="su-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="su-email">
                <Mail className="inline mr-1.5 size-3.5" />
                Email Address
              </Label>
              <Input
                id="su-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="su-phone">
                <Phone className="inline mr-1.5 size-3.5" />
                Phone Number
              </Label>
              <Input
                id="su-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+251..."
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

      {/* ── Security Card ── */}
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
            <Label htmlFor="su-current-pw">Current Password</Label>
            <div className="relative">
              <Input
                id="su-current-pw"
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
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="su-new-pw">New Password</Label>
              <div className="relative">
                <Input
                  id="su-new-pw"
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
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="su-confirm-pw">Confirm New Password</Label>
              <Input
                id="su-confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-rose-500 font-medium">
              Passwords do not match
            </p>
          )}

          {newPassword && newPassword.length > 0 && newPassword.length < 6 && (
            <p className="text-xs text-rose-500 font-medium">
              Password must be at least 6 characters
            </p>
          )}

          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              onClick={handlePasswordChange}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
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

      {/* ── System Preferences ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            System Preferences
          </CardTitle>
          <CardDescription>
            Configure default settings for the entire system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="su-appname">
              <Building2 className="inline mr-1.5 size-3.5" />
              Application Name
            </Label>
            <Input
              id="su-appname"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="GHMS"
            />
            <p className="text-xs text-slate-400">
              Displayed in the sidebar and browser tab.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="su-currency">
                <Clock className="inline mr-1.5 size-3.5" />
                Default Currency
              </Label>
              <Select
                value={defaultCurrency}
                onValueChange={setDefaultCurrency}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB (Birr)</SelectItem>
                  <SelectItem value="USD">USD (Dollar)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="su-language">
                <Globe className="inline mr-1.5 size-3.5" />
                Default Language
              </Label>
              <Select
                value={defaultLanguage}
                onValueChange={setDefaultLanguage}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="am">አማርኛ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={handleSystemSave} disabled={savingSystem}>
              {savingSystem ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
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

  // SUPERUSER sees profile management
  if (currentUser?.role === "SUPERUSER") {
    return <SuperuserSettings />;
  }

  // OPERATOR / STAFF see guest house settings
  return <ProviderSettings />;
}
