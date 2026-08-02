"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  Search,
  Download,
  Filter,
  Calendar,
  Shield,
  FileDown,
  Activity,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  Globe,
  Eye,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// ── Types ──

interface AuditLog {
  id: string;
  officerName: string;
  action: string;
  targetId: string;
  targetType: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

interface AuditStats {
  total: number;
  today: number;
  thisWeek: number;
  critical: number;
}

const ACTION_TYPES = [
  "LOGIN",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "EXPORT",
  "APPROVE",
  "REJECT",
  "SUSPEND",
  "CONFIG_CHANGE",
  "BACKUP",
  "LOGIN_FAILED",
];

const CRITICAL_ACTIONS = ["DELETE", "SUSPEND", "CONFIG_CHANGE", "APPROVE", "REJECT", "LOGIN_FAILED"];

function getActionIcon(action: string) {
  const lower = action.toLowerCase();
  if (lower === "login" || lower === "login_failed") return <LogIn className="h-3.5 w-3.5" />;
  if (lower === "logout") return <LogOut className="h-3.5 w-3.5" />;
  if (lower === "create") return <Plus className="h-3.5 w-3.5" />;
  if (lower === "update") return <Pencil className="h-3.5 w-3.5" />;
  if (lower === "delete") return <Trash2 className="h-3.5 w-3.5" />;
  if (lower === "view") return <Eye className="h-3.5 w-3.5" />;
  if (lower === "export" || lower === "backup") return <FileDown className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
}

function getActionColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower === "login") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (lower === "logout") return "bg-slate-100 text-slate-600 border-slate-200";
  if (lower === "create" || lower === "approve") return "bg-sky-100 text-sky-700 border-sky-200";
  if (lower === "update") return "bg-amber-100 text-amber-700 border-amber-200";
  if (lower === "delete" || lower === "suspend") return "bg-rose-100 text-rose-700 border-rose-200";
  if (lower === "view") return "bg-violet-100 text-violet-600 border-violet-200";
  if (lower === "export" || lower === "backup") return "bg-cyan-100 text-cyan-700 border-cyan-200";
  if (lower === "reject") return "bg-orange-100 text-orange-700 border-orange-200";
  if (lower === "login_failed") return "bg-red-100 text-red-700 border-red-200";
  if (lower === "config_change") return "bg-pink-100 text-pink-700 border-pink-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function isToday(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  } catch {
    return false;
  }
}

function isThisWeek(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return date >= startOfWeek;
  } catch {
    return false;
  }
}

// ── Component ──

export default function SuperAuditLogsPage() {
  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Data
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    today: 0,
    thisWeek: 0,
    critical: 0,
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const limit = 20;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set("search", search);
      if (actionFilter && actionFilter !== "ALL")
        params.set("action", actionFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/police-audit?${params.toString()}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);

        // Compute stats from the full data
        const allLogs = data.logs ?? [];
        setStats({
          total: data.total ?? allLogs.length,
          today: allLogs.filter((l: AuditLog) => isToday(l.createdAt)).length,
          thisWeek: allLogs.filter((l: AuditLog) =>
            isThisWeek(l.createdAt)
          ).length,
          critical: allLogs.filter((l: AuditLog) =>
            CRITICAL_ACTIONS.includes(l.action.toUpperCase())
          ).length,
        });
      } else {
        toast.error("Failed to fetch audit logs");
        setLogs([]);
        setTotal(0);
      }
    } catch {
      toast.error("Network error fetching audit logs");
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Apply search on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(searchInput);
      setPage(1);
    }
  };

  const handleSearchClick = () => {
    setSearch(searchInput);
    setPage(1);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setSearchInput("");
    setActionFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  // Export logs as CSV
  const handleExportLogs = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("ghms_token");
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const params = new URLSearchParams({
        page: "1",
        limit: "1000",
      });
      if (search) params.set("search", search);
      if (actionFilter && actionFilter !== "ALL")
        params.set("action", actionFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/police-audit?${params.toString()}`, {
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        const exportLogs: AuditLog[] = data.logs ?? [];

        // Build CSV
        const csvHeader =
          "Timestamp,Officer/User,Action,Target,Target Type,IP Address,Details";
        const csvRows = exportLogs.map((log) =>
          [
            formatTimestamp(log.createdAt),
            log.officerName,
            log.action,
            log.targetId,
            log.targetType,
            log.ipAddress,
            `"${(log.details || "").replace(/"/g, '""')}"`,
          ].join(",")
        );
        const csvContent = [csvHeader, ...csvRows].join("\n");

        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(
          `Exported ${exportLogs.length} log entries successfully`
        );
      } else {
        toast.error("Failed to export logs");
      }
    } catch {
      toast.error("Network error exporting logs");
    } finally {
      setExporting(false);
    }
  };

  // Stat cards config
  const statCards = [
    {
      label: "Total Entries",
      value: stats.total,
      icon: <ClipboardList className="h-4 w-4" />,
      color: "text-slate-700",
      bg: "bg-slate-100",
      border: "border-slate-200",
      iconBg: "bg-slate-200",
    },
    {
      label: "Today",
      value: stats.today,
      icon: <Activity className="h-4 w-4" />,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      iconBg: "bg-emerald-200",
    },
    {
      label: "This Week",
      value: stats.thisWeek,
      icon: <Calendar className="h-4 w-4" />,
      color: "text-sky-700",
      bg: "bg-sky-50",
      border: "border-sky-200",
      iconBg: "bg-sky-200",
    },
    {
      label: "Critical",
      value: stats.critical,
      icon: <Shield className="h-4 w-4" />,
      color: "text-rose-700",
      bg: "bg-rose-50",
      border: "border-rose-200",
      iconBg: "bg-rose-200",
    },
  ];

  // Page numbers to display
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);

      if (page <= 3) {
        start = 2;
        end = maxVisible;
      } else if (page >= totalPages - 2) {
        start = totalPages - maxVisible + 1;
        end = totalPages - 1;
      }

      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  // ── Loading Skeleton ──
  if (loading && page === 1 && !search && actionFilter === "ALL" && !dateFrom && !dateTo) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-12 w-64 rounded-lg mx-auto" />
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
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Complete system activity trail for Guest House Management System
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportLogs}
          disabled={exporting}
          className="w-fit gap-2 border-slate-300 hover:bg-slate-50"
        >
          {exporting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "Exporting..." : "Export Logs"}
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

      {/* ── Filters Row ── */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Search */}
              <div className="relative lg:col-span-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-9 border-slate-300"
                />
              </div>

              {/* Action Type Dropdown */}
              <Select
                value={actionFilter}
                onValueChange={(val) => {
                  setActionFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="border-slate-300">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date From */}
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 border-slate-300"
                />
              </div>

              {/* Date To */}
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 border-slate-300"
                />
              </div>

              {/* Reset Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="w-full gap-2 border-slate-300 hover:bg-slate-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            </div>

            {/* Active filter badges */}
            {(search || (actionFilter && actionFilter !== "ALL") || dateFrom || dateTo) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500">Active filters:</span>
                {search && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Search: &quot;{search}&quot;
                    <button
                      onClick={() => {
                        setSearch("");
                        setSearchInput("");
                        setPage(1);
                      }}
                      className="ml-1 rounded-full hover:bg-slate-300 p-0.5"
                    >
                      <ArrowRight className="h-2.5 w-2.5 rotate-45" />
                    </button>
                  </Badge>
                )}
                {actionFilter && actionFilter !== "ALL" && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Action: {actionFilter}
                    <button
                      onClick={() => {
                        setActionFilter("ALL");
                        setPage(1);
                      }}
                      className="ml-1 rounded-full hover:bg-slate-300 p-0.5"
                    >
                      <ArrowRight className="h-2.5 w-2.5 rotate-45" />
                    </button>
                  </Badge>
                )}
                {dateFrom && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    From: {dateFrom}
                    <button
                      onClick={() => {
                        setDateFrom("");
                        setPage(1);
                      }}
                      className="ml-1 rounded-full hover:bg-slate-300 p-0.5"
                    >
                      <ArrowRight className="h-2.5 w-2.5 rotate-45" />
                    </button>
                  </Badge>
                )}
                {dateTo && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    To: {dateTo}
                    <button
                      onClick={() => {
                        setDateTo("");
                        setPage(1);
                      }}
                      className="ml-1 rounded-full hover:bg-slate-300 p-0.5"
                    >
                      <ArrowRight className="h-2.5 w-2.5 rotate-45" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Logs Table ── */}
      <Card className="border-slate-200 overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <FileText className="h-4 w-4 text-slate-500" />
            Activity Log Entries
            <Badge variant="secondary" className="ml-auto text-xs bg-slate-100 text-slate-600">
              {total} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 px-4 py-3 ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-3">
                <ClipboardList className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700">No audit logs found</p>
              <p className="mt-1 text-xs text-slate-500">
                {search || actionFilter !== "ALL" || dateFrom || dateTo
                  ? "Try adjusting your filters to find what you are looking for."
                  : "No activity has been recorded yet."}
              </p>
              {(search || actionFilter !== "ALL" || dateFrom || dateTo) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  className="mt-3 gap-2 text-xs border-slate-300"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    <th className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">
                      Officer / User
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">
                      Action
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">
                      Target
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">
                      IP Address
                    </th>
                    <th className="px-4 py-3 border-b border-slate-200 whitespace-nowrap">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, idx) => (
                    <tr
                      key={log.id}
                      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 cursor-default ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Activity className="h-3 w-3 text-slate-400" />
                          <span className="text-xs font-mono">
                            {formatTimestamp(log.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium text-slate-800">
                            {log.officerName || "System"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`gap-1 text-xs font-medium ${getActionColor(
                            log.action
                          )}`}
                        >
                          {getActionIcon(log.action)}
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-800">
                            {log.targetId || "—"}
                          </span>
                          {log.targetType && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {log.targetType}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-slate-400" />
                          {log.ipAddress || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="line-clamp-2 text-xs">
                          {log.details || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-700">
              {(page - 1) * limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium text-slate-700">
              {Math.min(page * limit, total)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-700">{total}</span>{" "}
            entries
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 gap-1 border-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
              <ArrowLeft className="h-3 w-3" />
              Prev
            </Button>
            <div className="flex items-center gap-1 mx-1">
              {getPageNumbers().map((p, i) =>
                typeof p === "string" ? (
                  <span
                    key={`ellipsis-${i}`}
                    className="px-1.5 text-xs text-slate-400"
                  >
                    ...
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={page === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(p)}
                    className={`h-8 w-8 p-0 text-xs ${
                      page === p
                        ? "bg-slate-900 hover:bg-slate-800 text-white"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </Button>
                )
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 gap-1 border-slate-300"
            >
              Next
              <ArrowRight className="h-3 w-3" />
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
