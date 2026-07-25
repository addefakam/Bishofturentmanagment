"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetSettings,
  apiUpdateSettings,
  apiExportData,
  apiImportData,
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
import { Settings, Download, Upload, Save, Loader2 } from "lucide-react";

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

export default function SettingsPage() {
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