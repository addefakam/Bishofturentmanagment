"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Settings,
  Globe,
  Building2,
  Shield,
  Bell,
  Save,
  RotateCcw,
  Info,
  Clock,
  Lock,
  Mail,
  MessageSquare,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// ── Types ──

type TabKey = "general" | "guesthouse" | "security" | "notifications";

interface GeneralSettings {
  systemName: string;
  systemDescription: string;
  defaultLanguage: string;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
}

interface GuesthouseSettings {
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  autoApproveGuesthouses: boolean;
  maxRoomsPerGuesthouse: number;
  requireLicenseUpload: boolean;
  defaultTaxRate: number;
}

interface SecuritySettings {
  passwordMinLength: number;
  sessionTimeoutHours: number;
  maxLoginAttempts: number;
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  ipWhitelist: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  alertEscalationDelay: number;
  criticalAlertsImmediate: boolean;
  anomalyDetectionEnabled: boolean;
  notificationEmailRecipients: string;
}

interface SystemConfig {
  general: GeneralSettings;
  guesthouse: GuesthouseSettings;
  security: SecuritySettings;
  notifications: NotificationSettings;
}

// ── Defaults ──

const SYSTEM_VERSION = "1.4.0";

const DEFAULT_GENERAL: GeneralSettings = {
  systemName: "GHMS",
  systemDescription: "Guest House Management System for managing guesthouses, reservations, and compliance.",
  defaultLanguage: "en",
  defaultCurrency: "ETB",
  timezone: "Africa/Addis_Ababa",
  maintenanceMode: false,
};

const DEFAULT_GUESTHOUSE: GuesthouseSettings = {
  defaultCheckInTime: "14:00",
  defaultCheckOutTime: "10:00",
  autoApproveGuesthouses: false,
  maxRoomsPerGuesthouse: 50,
  requireLicenseUpload: true,
  defaultTaxRate: 15,
};

const DEFAULT_SECURITY: SecuritySettings = {
  passwordMinLength: 8,
  sessionTimeoutHours: 24,
  maxLoginAttempts: 5,
  allowSelfRegistration: true,
  requireEmailVerification: true,
  ipWhitelist: "",
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailNotifications: true,
  smsNotifications: false,
  alertEscalationDelay: 30,
  criticalAlertsImmediate: true,
  anomalyDetectionEnabled: true,
  notificationEmailRecipients: "admin@ghms.et, security@ghms.et",
};

const FULL_DEFAULTS: SystemConfig = {
  general: DEFAULT_GENERAL,
  guesthouse: DEFAULT_GUESTHOUSE,
  security: DEFAULT_SECURITY,
  notifications: DEFAULT_NOTIFICATIONS,
};

// ── Tab Definitions ──

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: React.ElementType;
}> = [
  { key: "general", label: "General", icon: Globe },
  { key: "guesthouse", label: "Guesthouse", icon: Building2 },
  { key: "security", label: "Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
];

// ── Shared UI Components ──

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50";

const textareaClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-y min-h-[80px] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50";

const selectClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:18px] bg-[right_10px_center] bg-no-repeat pr-9";

function FormLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-slate-700 mb-1.5"
    >
      {children}
    </label>
  );
}

function ToggleSwitch({
  id,
  checked,
  onChange,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        `relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ` +
        (checked
          ? "bg-primary"
          : "bg-slate-300") +
        (disabled ? " opacity-50 cursor-not-allowed" : "")
      }
    >
      <span
        className={
          `pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ` +
          (checked ? "translate-x-6" : "translate-x-1")
        }
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 py-4">
      <div className="flex-1 min-w-0 sm:pr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="sm:w-64 shrink-0">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3 mb-1">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 shrink-0">
          <Icon className="w-4.5 h-4.5 text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass + (suffix ? " pr-10" : "")}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── Tab Panels ──

function GeneralTab({
  settings,
  onChange,
}: {
  settings: GeneralSettings;
  onChange: (partial: Partial<GeneralSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Basic Information */}
      <SectionCard
        title="Basic Information"
        description="Core system identity and branding settings"
        icon={Info}
      >
        <div className="py-4 space-y-4">
          <div>
            <FormLabel htmlFor="systemName">System Name</FormLabel>
            <input
              id="systemName"
              type="text"
              value={settings.systemName}
              onChange={(e) => onChange({ systemName: e.target.value })}
              className={inputClass}
              placeholder="Enter system name"
            />
          </div>
          <div>
            <FormLabel htmlFor="systemDescription">System Description</FormLabel>
            <textarea
              id="systemDescription"
              value={settings.systemDescription}
              onChange={(e) =>
                onChange({ systemDescription: e.target.value })
              }
              className={textareaClass}
              rows={3}
              placeholder="Describe the system purpose and scope"
            />
          </div>
        </div>
      </SectionCard>

      {/* Locale & Regional */}
      <SectionCard
        title="Locale & Regional"
        description="Language, currency, and timezone preferences"
        icon={Globe}
      >
        <SettingRow
          label="Default Language"
          description="Primary language for the system interface"
        >
          <select
            id="defaultLanguage"
            value={settings.defaultLanguage}
            onChange={(e) =>
              onChange({ defaultLanguage: e.target.value })
            }
            className={selectClass}
          >
            <option value="en">English</option>
            <option value="am">Amharic</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Default Currency"
          description="Default currency for financial transactions"
        >
          <select
            id="defaultCurrency"
            value={settings.defaultCurrency}
            onChange={(e) =>
              onChange({ defaultCurrency: e.target.value })
            }
            className={selectClass}
          >
            <option value="ETB">ETB — Ethiopian Birr</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Timezone"
          description="System-wide timezone for scheduling and reports"
        >
          <select
            id="timezone"
            value={settings.timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            className={selectClass}
          >
            <option value="Africa/Addis_Ababa">Africa/Addis_Ababa (EAT, UTC+3)</option>
            <option value="Africa/Nairobi">Africa/Nairobi (EAT, UTC+3)</option>
            <option value="Africa/Cairo">Africa/Cairo (EET, UTC+2)</option>
            <option value="Africa/Lagos">Africa/Lagos (WAT, UTC+1)</option>
            <option value="Africa/Johannesburg">
              Africa/Johannesburg (SAST, UTC+2)
            </option>
            <option value="UTC">UTC (Coordinated Universal Time)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
          </select>
        </SettingRow>
      </SectionCard>

      {/* System Operations */}
      <SectionCard
        title="System Operations"
        description="Operational modes and system information"
        icon={Settings}
      >
        <SettingRow
          label="Maintenance Mode"
          description="When enabled, the system enters read-only mode for non-admin users"
        >
          <div className="flex items-center gap-3">
            <ToggleSwitch
              id="maintenanceMode"
              checked={settings.maintenanceMode}
              onChange={(v) => onChange({ maintenanceMode: v })}
            />
            {settings.maintenanceMode && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Active
              </span>
            )}
          </div>
        </SettingRow>

        <SettingRow
          label="System Version"
          description="Currently installed version — read-only"
        >
          <input
            type="text"
            value={SYSTEM_VERSION}
            readOnly
            className={inputClass + " bg-slate-50 text-slate-500 cursor-not-allowed"}
          />
        </SettingRow>
      </SectionCard>
    </div>
  );
}

function GuesthouseTab({
  settings,
  onChange,
}: {
  settings: GuesthouseSettings;
  onChange: (partial: Partial<GuesthouseSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Check-in & Check-out */}
      <SectionCard
        title="Check-in & Check-out"
        description="Default scheduling for guest arrivals and departures"
        icon={Clock}
      >
        <SettingRow
          label="Default Check-in Time"
          description="Standard check-in time shown on all guesthouses"
        >
          <input
            id="defaultCheckInTime"
            type="time"
            value={settings.defaultCheckInTime}
            onChange={(e) =>
              onChange({ defaultCheckInTime: e.target.value })
            }
            className={inputClass}
          />
        </SettingRow>

        <SettingRow
          label="Default Check-out Time"
          description="Standard check-out time shown on all guesthouses"
        >
          <input
            id="defaultCheckOutTime"
            type="time"
            value={settings.defaultCheckOutTime}
            onChange={(e) =>
              onChange({ defaultCheckOutTime: e.target.value })
            }
            className={inputClass}
          />
        </SettingRow>
      </SectionCard>

      {/* Registration & Compliance */}
      <SectionCard
        title="Registration & Compliance"
        description="Policies for new guesthouse onboarding"
        icon={Building2}
      >
        <SettingRow
          label="Auto-approve Guesthouses"
          description="Automatically approve newly registered guesthouses without manual review"
        >
          <div className="flex items-center gap-3">
            <ToggleSwitch
              id="autoApproveGuesthouses"
              checked={settings.autoApproveGuesthouses}
              onChange={(v) => onChange({ autoApproveGuesthouses: v })}
            />
            {settings.autoApproveGuesthouses && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Bypasses review
              </span>
            )}
          </div>
        </SettingRow>

        <SettingRow
          label="Require License Upload"
          description="Require operators to upload a valid business license during registration"
        >
          <ToggleSwitch
            id="requireLicenseUpload"
            checked={settings.requireLicenseUpload}
            onChange={(v) => onChange({ requireLicenseUpload: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* Room & Tax Defaults */}
      <SectionCard
        title="Room & Tax Defaults"
        description="Default limits and financial settings for guesthouses"
        icon={Settings}
      >
        <SettingRow
          label="Max Rooms per Guesthouse"
          description="Maximum number of rooms allowed per guesthouse registration"
        >
          <NumberInput
            id="maxRoomsPerGuesthouse"
            value={settings.maxRoomsPerGuesthouse}
            onChange={(v) => onChange({ maxRoomsPerGuesthouse: v })}
            min={1}
            max={500}
          />
        </SettingRow>

        <SettingRow
          label="Default Tax Rate"
          description="Default VAT/tax percentage applied to room pricing"
        >
          <NumberInput
            id="defaultTaxRate"
            value={settings.defaultTaxRate}
            onChange={(v) => onChange({ defaultTaxRate: v })}
            min={0}
            max={100}
            step={0.5}
            suffix="%"
          />
        </SettingRow>
      </SectionCard>
    </div>
  );
}

function SecurityTab({
  settings,
  onChange,
}: {
  settings: SecuritySettings;
  onChange: (partial: Partial<SecuritySettings>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Authentication */}
      <SectionCard
        title="Authentication"
        description="Password policies and login session management"
        icon={Lock}
      >
        <SettingRow
          label="Password Minimum Length"
          description="Minimum number of characters required for user passwords"
        >
          <NumberInput
            id="passwordMinLength"
            value={settings.passwordMinLength}
            onChange={(v) => onChange({ passwordMinLength: v })}
            min={6}
            max={128}
          />
        </SettingRow>

        <SettingRow
          label="Max Login Attempts"
          description="Number of failed attempts before the account is temporarily locked"
        >
          <NumberInput
            id="maxLoginAttempts"
            value={settings.maxLoginAttempts}
            onChange={(v) => onChange({ maxLoginAttempts: v })}
            min={1}
            max={20}
          />
        </SettingRow>

        <SettingRow
          label="Session Timeout"
          description="Duration in hours before an inactive session expires"
        >
          <NumberInput
            id="sessionTimeoutHours"
            value={settings.sessionTimeoutHours}
            onChange={(v) => onChange({ sessionTimeoutHours: v })}
            min={1}
            max={720}
            suffix="hrs"
          />
        </SettingRow>
      </SectionCard>

      {/* Registration Policies */}
      <SectionCard
        title="Registration Policies"
        description="Controls for user self-registration and verification"
        icon={Shield}
      >
        <SettingRow
          label="Allow Self-Registration"
          description="Permit new users to create accounts without an admin invitation"
        >
          <ToggleSwitch
            id="allowSelfRegistration"
            checked={settings.allowSelfRegistration}
            onChange={(v) => onChange({ allowSelfRegistration: v })}
          />
        </SettingRow>

        <SettingRow
          label="Require Email Verification"
          description="Users must verify their email address before accessing the system"
        >
          <ToggleSwitch
            id="requireEmailVerification"
            checked={settings.requireEmailVerification}
            onChange={(v) => onChange({ requireEmailVerification: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* Network Access */}
      <SectionCard
        title="Network Access"
        description="IP-based access control for the system"
        icon={Shield}
      >
        <div className="py-4 space-y-4">
          <div>
            <FormLabel htmlFor="ipWhitelist">IP Whitelist</FormLabel>
            <p className="text-xs text-slate-500 mb-2">
              Comma-separated list of allowed IP addresses or CIDR ranges.
              Leave empty to allow all IPs.
            </p>
            <textarea
              id="ipWhitelist"
              value={settings.ipWhitelist}
              onChange={(e) => onChange({ ipWhitelist: e.target.value })}
              className={textareaClass}
              rows={3}
              placeholder="e.g. 192.168.1.0/24, 10.0.0.1"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function NotificationsTab({
  settings,
  onChange,
}: {
  settings: NotificationSettings;
  onChange: (partial: Partial<NotificationSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Notification Channels */}
      <SectionCard
        title="Notification Channels"
        description="Enable or disable notification delivery methods"
        icon={MessageSquare}
      >
        <SettingRow
          label="Email Notifications"
          description="Send system alerts and updates via email"
        >
          <ToggleSwitch
            id="emailNotifications"
            checked={settings.emailNotifications}
            onChange={(v) => onChange({ emailNotifications: v })}
          />
        </SettingRow>

        <SettingRow
          label="SMS Notifications"
          description="Send urgent alerts and verification codes via SMS"
        >
          <ToggleSwitch
            id="smsNotifications"
            checked={settings.smsNotifications}
            onChange={(v) => onChange({ smsNotifications: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* Alert Configuration */}
      <SectionCard
        title="Alert Configuration"
        description="Configure how and when alerts are escalated"
        icon={AlertTriangle}
      >
        <SettingRow
          label="Alert Escalation Delay"
          description="Minutes before an unacknowledged alert is escalated to the next level"
        >
          <NumberInput
            id="alertEscalationDelay"
            value={settings.alertEscalationDelay}
            onChange={(v) => onChange({ alertEscalationDelay: v })}
            min={1}
            max={1440}
            suffix="min"
          />
        </SettingRow>

        <SettingRow
          label="Critical Alerts Immediate"
          description="Bypass escalation delay and immediately send critical alerts to all channels"
        >
          <ToggleSwitch
            id="criticalAlertsImmediate"
            checked={settings.criticalAlertsImmediate}
            onChange={(v) => onChange({ criticalAlertsImmediate: v })}
          />
        </SettingRow>

        <SettingRow
          label="Anomaly Detection Enabled"
          description="Automatically detect and alert on suspicious guesthouse activity patterns"
        >
          <ToggleSwitch
            id="anomalyDetectionEnabled"
            checked={settings.anomalyDetectionEnabled}
            onChange={(v) => onChange({ anomalyDetectionEnabled: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* Recipients */}
      <SectionCard
        title="Notification Recipients"
        description="Email addresses that receive system-level notifications"
        icon={Mail}
      >
        <div className="py-4 space-y-4">
          <div>
            <FormLabel htmlFor="notificationEmailRecipients">
              Email Recipients
            </FormLabel>
            <p className="text-xs text-slate-500 mb-2">
              Comma-separated list of email addresses that receive system
              notifications and alerts.
            </p>
            <textarea
              id="notificationEmailRecipients"
              value={settings.notificationEmailRecipients}
              onChange={(e) =>
                onChange({ notificationEmailRecipients: e.target.value })
              }
              className={textareaClass}
              rows={3}
              placeholder="e.g. admin@ghms.et, ops@ghms.et, security@ghms.et"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Main Page Component ──

export default function SuperSystemConfigPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [config, setConfig] = useState<SystemConfig>(FULL_DEFAULTS);

  // ── Fetch settings on mount ──

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/settings", { headers });

      if (!res.ok) {
        throw new Error(`Failed to fetch settings (${res.status})`);
      }

      const data = await res.json();

      // Merge fetched data with defaults to ensure all keys exist
      setConfig({
        general: { ...DEFAULT_GENERAL, ...data.general },
        guesthouse: { ...DEFAULT_GUESTHOUSE, ...data.guesthouse },
        security: { ...DEFAULT_SECURITY, ...data.security },
        notifications: { ...DEFAULT_NOTIFICATIONS, ...data.notifications },
      });
    } catch (err) {
      // API may not support this shape yet — use defaults
      console.warn("Could not load system config, using defaults:", err);
      setConfig(FULL_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Save settings ──

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers,
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        // Fallback to POST if PUT not supported
        const resPost = await fetch("/api/settings", {
          method: "POST",
          headers,
          body: JSON.stringify(config),
        });
        if (!resPost.ok) {
          throw new Error(`Failed to save settings (${resPost.status})`);
        }
      }

      setDirty(false);
      toast.success("System configuration saved successfully");
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("Failed to save configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset to defaults ──

  const handleReset = () => {
    setConfig(FULL_DEFAULTS);
    setDirty(true);
    toast.info("All settings reset to defaults. Save to apply.");
  };

  // ── Updaters ──

  const updateGeneral = useCallback(
    (partial: Partial<GeneralSettings>) => {
      setConfig((prev) => ({ ...prev, general: { ...prev.general, ...partial } }));
      setDirty(true);
    },
    []
  );

  const updateGuesthouse = useCallback(
    (partial: Partial<GuesthouseSettings>) => {
      setConfig((prev) => ({
        ...prev,
        guesthouse: { ...prev.guesthouse, ...partial },
      }));
      setDirty(true);
    },
    []
  );

  const updateSecurity = useCallback(
    (partial: Partial<SecuritySettings>) => {
      setConfig((prev) => ({
        ...prev,
        security: { ...prev.security, ...partial },
      }));
      setDirty(true);
    },
    []
  );

  const updateNotifications = useCallback(
    (partial: Partial<NotificationSettings>) => {
      setConfig((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, ...partial },
      }));
      setDirty(true);
    },
    []
  );

  // ── Render ──

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 shrink-0">
            <Settings className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              System Configuration
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Configure Guest House Management System settings and preferences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="border-b border-slate-200 mb-6 overflow-x-auto scrollbar-none">
        <nav className="flex gap-0 min-w-max" role="tablist" aria-label="Configuration sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={
                  `relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none ` +
                  (isActive
                    ? "text-primary border-b-2 border-primary"
                    : "text-slate-500 hover:text-slate-700 border-b-2 border-transparent")
                }
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab Content ── */}
      {loading ? (
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5 animate-pulse"
            >
              <div className="flex items-start gap-3 mb-6">
                <div className="w-9 h-9 rounded-lg bg-slate-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-40 rounded bg-slate-100" />
                  <div className="h-3 w-56 rounded bg-slate-50" />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between py-3">
                  <div className="space-y-2 flex-1 pr-4">
                    <div className="h-4 w-36 rounded bg-slate-100" />
                    <div className="h-3 w-48 rounded bg-slate-50" />
                  </div>
                  <div className="h-9 w-56 rounded-lg bg-slate-100" />
                </div>
                <div className="flex justify-between py-3">
                  <div className="space-y-2 flex-1 pr-4">
                    <div className="h-4 w-32 rounded bg-slate-100" />
                    <div className="h-3 w-52 rounded bg-slate-50" />
                  </div>
                  <div className="h-9 w-56 rounded-lg bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div role="tabpanel" id={`panel-${activeTab}`}>
          {activeTab === "general" && (
            <GeneralTab settings={config.general} onChange={updateGeneral} />
          )}
          {activeTab === "guesthouse" && (
            <GuesthouseTab
              settings={config.guesthouse}
              onChange={updateGuesthouse}
            />
          )}
          {activeTab === "security" && (
            <SecurityTab
              settings={config.security}
              onChange={updateSecurity}
            />
          )}
          {activeTab === "notifications" && (
            <NotificationsTab
              settings={config.notifications}
              onChange={updateNotifications}
            />
          )}
        </div>
      )}
    </div>
  );
}
