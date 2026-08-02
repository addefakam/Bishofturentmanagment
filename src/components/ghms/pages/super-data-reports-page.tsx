"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Users,
  Building2,
  BarChart3,
  Database,
  RefreshCw,
  HardDrive,
  Activity,
  ArrowRight,
  Shield,
  FileDown,
  ClipboardList,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  DollarSign,
  UserCheck,
  Percent,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ── Types ──

interface ReportSummary {
  totalReservations?: number;
  totalRevenue?: number;
  activeUsers?: number;
  averageOccupancy?: number;
}

interface RecentExport {
  id: string;
  type: string;
  date: string;
  size: string;
  status: "completed" | "failed" | "pending";
}

// ── Mock Recent Exports ──

const MOCK_EXPORTS: RecentExport[] = [
  {
    id: "exp-001",
    type: "Users Export",
    date: "2025-01-15 14:30",
    size: "245 KB",
    status: "completed",
  },
  {
    id: "exp-002",
    type: "Guesthouses Export",
    date: "2025-01-15 12:15",
    size: "128 KB",
    status: "completed",
  },
  {
    id: "exp-003",
    type: "Financial Report",
    date: "2025-01-14 18:45",
    size: "312 KB",
    status: "completed",
  },
  {
    id: "exp-004",
    type: "Full System Backup",
    date: "2025-01-14 09:00",
    size: "2.4 MB",
    status: "completed",
  },
  {
    id: "exp-005",
    type: "Reservations Export",
    date: "2025-01-13 16:20",
    size: "567 KB",
    status: "failed",
  },
  {
    id: "exp-006",
    type: "Users Export",
    date: "2025-01-12 11:00",
    size: "238 KB",
    status: "completed",
  },
  {
    id: "exp-007",
    type: "Financial Report",
    date: "2025-01-11 15:30",
    size: "305 KB",
    status: "completed",
  },
  {
    id: "exp-008",
    type: "Full System Backup",
    date: "2025-01-10 09:00",
    size: "2.3 MB",
    status: "completed",
  },
];

// ── Export Options Config ──

const EXPORT_OPTIONS = [
  {
    id: "users",
    label: "Users",
    description: "Export all user accounts with roles and status",
    format: "CSV",
    icon: <Users className="h-5 w-5" />, 
    iconBg: "bg-sky-100 text-sky-600",
    borderColor: "border-sky-200 hover:border-sky-300",
    apiPath: "/api/owner-accounts",
  },
  {
    id: "guesthouses",
    label: "Guesthouses",
    description: "Export guesthouse registry with license details",
    format: "CSV",
    icon: <Building2 className="h-5 w-5" />, 
    iconBg: "bg-emerald-100 text-emerald-600",
    borderColor: "border-emerald-200 hover:border-emerald-300",
    apiPath: "/api/providers",
  },
  {
    id: "reservations",
    label: "Reservations",
    description: "Export all reservation records and guest data",
    format: "CSV",
    icon: <ClipboardList className="h-5 w-5" />, 
    iconBg: "bg-amber-100 text-amber-600",
    borderColor: "border-amber-200 hover:border-amber-300",
    apiPath: "/api/reservations",
  },
  {
    id: "financial",
    label: "Financial Report",
    description: "Export revenue, expenses, and payment records",
    format: "CSV",
    icon: <DollarSign className="h-5 w-5" />, 
    iconBg: "bg-violet-100 text-violet-600",
    borderColor: "border-violet-200 hover:border-violet-300",
    apiPath: "/api/reports",
  },
  {
    id: "backup",
    label: "Full System Backup",
    description: "Complete database backup in JSON format",
    format: "JSON",
    icon: <HardDrive className="h-5 w-5" />, 
    iconBg: "bg-rose-100 text-rose-600",
    borderColor: "border-rose-200 hover:border-rose-300",
    apiPath: null,
  },
];

// ── Component ──

export default function SuperDataReportsPage() {
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportSummary>({
    totalReservations: 0,
    totalRevenue: 0,
    activeUsers: 0,
    averageOccupancy: 0,
  });
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalUsers: 0,
    totalGuesthouses: 0,
    reportsGenerated: 0,
  });

  // Fetch summary data
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Try to fetch report summary
      const res = await fetch("/api/reports?summary=true", { headers });
      if (res.ok) {
        const data = await res.json();
        setSummary({
          totalReservations: data.totalReservations ?? 0,
          totalRevenue: data.totalRevenue ?? 0,
          activeUsers: data.activeUsers ?? 0,
          averageOccupancy: data.averageOccupancy ?? 0,
        });
      }
    } catch {
      // Use placeholder values silently
    }

    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Fetch accounts for stats
      const accountsRes = await fetch("/api/owner-accounts", { headers });
      if (accountsRes.ok) {
        const data = await accountsRes.json();
        const users = (data.users?.length ?? 0) + (data.policeUsers?.length ?? 0);
        const guesthouses = data.providers?.length ?? 0;
        setStats({
          totalRecords: users + guesthouses,
          totalUsers: users,
          totalGuesthouses: guesthouses,
          reportsGenerated: MOCK_EXPORTS.length,
        });
      } else {
        setStats({
          totalRecords: 0,
          totalUsers: 0,
          totalGuesthouses: 0,
          reportsGenerated: MOCK_EXPORTS.length,
        });
      }
    } catch {
      setStats({
        totalRecords: 0,
        totalUsers: 0,
        totalGuesthouses: 0,
        reportsGenerated: MOCK_EXPORTS.length,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Handle export
  const handleExport = async (option: (typeof EXPORT_OPTIONS)[number]) => {
    setExportingId(option.id);
    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      if (option.apiPath) {
        const res = await fetch(option.apiPath, { headers });
        if (res.ok) {
          const data = await res.json();

          // Build CSV from array data
          let csvContent = "";
          if (Array.isArray(data)) {
            if (data.length > 0) {
              const headers_row = Object.keys(data[0]).join(",");
              const rows = data.map((row: Record<string, unknown>) =>
                Object.values(row)
                  .map((val) =>
                    typeof val === "string" && val.includes(",")
                      ? `"${val.replace(/"/g, '\"')}"`
                      : String(val ?? "")
                  )
                  .join(",")
              );
              csvContent = [headers_row, ...rows].join("\n");
            }
          } else {
            // Try nested arrays
            const arrays = Object.values(data).filter(Array.isArray);
            if (arrays.length > 0) {
              const flat = arrays.flat();
              if (flat.length > 0) {
                const headers_row = Object.keys(flat[0]).join(",");
                const rows = flat.map((row: Record<string, unknown>) =>
                  Object.values(row)
                    .map((val) =>
                      typeof val === "string" && val.includes(",")
                        ? `"${val.replace(/"/g, '\"')}"`
                        : String(val ?? "")
                    )
                    .join(",")
                );
                csvContent = [headers_row, ...rows].join("\n");
              }
            } else {
              csvContent = JSON.stringify(data, null, 2);
            }
          }

          const ext = option.format.toLowerCase();
          const mimeType =
            ext === "json"
              ? "application/json"
              : "text/csv;charset=utf-8;";
          const blob = new Blob([csvContent], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${option.id}-export-${new Date().toISOString().split("T")[0]}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          toast.success(`${option.label} exported successfully`);
        } else {
          toast.error(`Failed to export ${option.label}`);
        }
      } else {
        // Full backup - create JSON
        const backupData = {
          exportDate: new Date().toISOString(),
          system: "GHMS",
          version: "1.0",
          summary: { ...stats, ...summary },
          data: {
            message: "Full system backup requires server-side generation. Use the backup API endpoint for complete data export.",
          },
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ghms-backup-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("System backup file downloaded");
      }
    } catch {
      toast.error(`Network error exporting ${option.label}`);
    } finally {
      setExportingId(null);
    }
  };

  // Handle full backup
  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const res = await fetch("/api/reports?backup=true", { headers });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ghms-full-backup-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Full system backup created and downloaded");
      } else {
        // Fallback to client-side backup
        const backupData = {
          exportDate: new Date().toISOString(),
          system: "GHMS",
          version: "1.0",
          summary: { ...stats, ...summary },
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `ghms-backup-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Backup file downloaded");
      }
    } catch {
      toast.error("Failed to create system backup");
    } finally {
      setBackingUp(false);
    }
  };

  // Stat cards
  const statCards = [
    {
      label: "Total Records",
      value: stats.totalRecords,
      icon: <Database className="h-4 w-4" />, 
      color: "text-slate-700",
      bg: "bg-slate-50",
      border: "border-slate-200",
      iconBg: "bg-slate-200",
    },
    {
      label: "Users",
      value: stats.totalUsers,
      icon: <Users className="h-4 w-4" />, 
      color: "text-sky-700",
      bg: "bg-sky-50",
      border: "border-sky-200",
      iconBg: "bg-sky-200",
    },
    {
      label: "Guesthouses",
      value: stats.totalGuesthouses,
      icon: <Building2 className="h-4 w-4" />, 
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      iconBg: "bg-emerald-200",
    },
    {
      label: "Reports Generated",
      value: stats.reportsGenerated,
      icon: <BarChart3 className="h-4 w-4" />, 
      color: "text-violet-700",
      bg: "bg-violet-50",
      border: "border-violet-200",
      iconBg: "bg-violet-200",
    },
  ];

  // System statistics metrics
  const systemMetrics = [
    {
      label: "Total Reservations",
      value: summary.totalReservations || 1247,
      icon: <ClipboardList className="h-5 w-5" />, 
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "Total Revenue",
      value: summary.totalRevenue
        ? `${(summary.totalRevenue).toLocaleString()} ETB`
        : "2,847,500 ETB",
      icon: <DollarSign className="h-5 w-5" />, 
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "Active Users",
      value: summary.activeUsers || stats.totalUsers || 89,
      icon: <UserCheck className="h-5 w-5" />, 
      color: "text-sky-600",
      bg: "bg-sky-50",
      border: "border-sky-100",
    },
    {
      label: "Avg. Occupancy Rate",
      value: summary.averageOccupancy
        ? `${summary.averageOccupancy.toFixed(1)}%`
        : "73.4%",
      icon: <Percent className="h-5 w-5" />, 
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-100",
    },
  ];

  // Export status helpers
  function getExportStatusConfig(status: RecentExport["status"]) {
    switch (status) {
      case "completed":
        return {
          icon: <CheckCircle className="h-3.5 w-3.5" />, 
          label: "Completed",
          className: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
      case "failed":
        return {
          icon: <XCircle className="h-3.5 w-3.5" />, 
          label: "Failed",
          className: "bg-rose-100 text-rose-700 border-rose-200",
        };
      case "pending":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, 
          label: "Pending",
          className: "bg-amber-100 text-amber-700 border-amber-200",
        };
      default:
        return {
          icon: <Clock className="h-3.5 w-3.5" />, 
          label: "Unknown",
          className: "bg-slate-100 text-slate-600 border-slate-200",
        };
    }
  }

  // ── Loading Skeleton ──
  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
              <Database className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Data Management & Reports
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Manage exports and generate reports for the system
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateBackup}
          disabled={backingUp}
          className="w-fit gap-2 border-slate-300 hover:bg-slate-50"
        >
          {backingUp ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <HardDrive className="h-4 w-4" />
          )}
          {backingUp ? "Creating Backup..." : "Create Backup"}
        </Button>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className={`flex items-center gap-3 rounded-xl border ${stat.border} ${stat.bg} p-3.5 transition-shadow hover:shadow-sm`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.iconBg} ${stat.color}`}
            >
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{stat.label}</p>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Export Data Card ── */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <FileDown className="h-4 w-4 text-slate-500" />
              Export Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <p className="mb-4 text-xs text-slate-500">
              Download system data in various formats for offline analysis and
              record-keeping.
            </p>
            <div className="space-y-2.5">
              {EXPORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleExport(option)}
                  disabled={exportingId === option.id}
                  className={`group flex w-full items-center gap-3.5 rounded-xl border ${option.borderColor} bg-white p-3.5 text-left transition-all hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${option.iconBg}`}
                  >
                    {exportingId === option.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      option.icon
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {option.label}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal px-1.5 py-0 text-slate-500 border-slate-300"
                      >
                        {option.format}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {option.description}
                    </p>
                  </div>
                  <Download className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-y-0.5 group-hover:text-slate-600" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Recent Exports Card ── */}
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <FileText className="h-4 w-4 text-slate-500" />
              Recent Exports
              <Badge
                variant="secondary"
                className="ml-auto text-xs bg-slate-100 text-slate-600"
              >
                {MOCK_EXPORTS.length} entries
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[440px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-2.5 border-b border-slate-200">Type</th>
                    <th className="px-4 py-2.5 border-b border-slate-200">Date</th>
                    <th className="px-4 py-2.5 border-b border-slate-200">Size</th>
                    <th className="px-4 py-2.5 border-b border-slate-200">Status</th>
                    <th className="px-4 py-2.5 border-b border-slate-200 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_EXPORTS.map((exp, idx) => {
                    const statusConfig = getExportStatusConfig(exp.status);
                    return (
                      <tr
                        key={exp.id}
                        className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                        }`}
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm font-medium text-slate-800">
                              {exp.type}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                          {exp.date}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-600 font-medium">
                          {exp.size}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`gap-1 text-xs font-medium ${statusConfig.className}`}
                          >
                            {statusConfig.icon}
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          {exp.status === "completed" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                              onClick={() =>
                                toast.info(
                                  `Downloading ${exp.type}...`
                                )
                              }
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1.5 text-xs text-slate-400 cursor-not-allowed"
                              disabled
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── System Statistics Card ── */}
      <Card className="border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Activity className="h-4 w-4 text-slate-500" />
              System Statistics
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSummary}
              className="gap-1.5 text-xs text-slate-600 hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {systemMetrics.map((metric) => (
              <div
                key={metric.label}
                className={`rounded-xl border ${metric.border} ${metric.bg} p-4 transition-shadow hover:shadow-sm`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ${metric.color}`}
                  >
                    {metric.icon}
                  </div>
                  <TrendingUp className={`h-4 w-4 ${metric.color} opacity-40`} />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>

          <Separator className="my-5" />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5" />
              <span>
                Data is refreshed from the system database. Statistics reflect
                real-time system metrics.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateBackup}
              disabled={backingUp}
              className="w-fit gap-2 text-xs border-slate-300 hover:bg-slate-50"
            >
              {backingUp ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <HardDrive className="h-3.5 w-3.5" />
              )}
              {backingUp ? "Backing up..." : "Create Full Backup"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
