"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ClipboardList,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Eye,
  FileDown,
  Shield,
  Users,
  Activity,
  AlertTriangle,
  Globe,
  Monitor,
  X,
  Filter,
  ChevronLeft,
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
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Types ──

interface UserSummary {
  userId: string;
  userName: string;
  userRole: string;
  providerName: string;
  officerName: string;
  lastActivity: string;
  lastLogin: string | null;
  lastIp: string;
  totalActions: number;
}

interface DetailLog {
  id: string;
  action: string;
  targetId: string;
  targetType: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

interface AuditStats {
  totalUsers: number;
  totalLogs: number;
  todayLogs: number;
  uniqueUsersToday: number;
}

// ── Helpers ──

function getRoleBadge(role: string) {
  const colors: Record<string, string> = {
    SUPERUSER: "bg-purple-100 text-purple-700 border-purple-200",
    OPERATOR: "bg-blue-100 text-blue-700 border-blue-200",
    STAFF: "bg-sky-100 text-sky-700 border-sky-200",
    POLICE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return colors[role] || "bg-slate-100 text-slate-600 border-slate-200";
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    SUPERUSER: "System Admin",
    OPERATOR: "Owner",
    STAFF: "Staff",
    POLICE: "Police",
  };
  return labels[role] || role;
}

function getActionIcon(action: string) {
  const lower = action.toLowerCase();
  if (lower === "login") return <LogIn className="size-3.5" />;
  if (lower === "logout") return <LogOut className="size-3.5" />;
  if (lower === "create" || lower === "approve") return <Plus className="size-3.5" />;
  if (lower === "update") return <Pencil className="size-3.5" />;
  if (lower === "delete" || lower === "suspend") return <Trash2 className="size-3.5" />;
  if (lower === "view" || lower.startsWith("view_")) return <Eye className="size-3.5" />;
  if (lower === "export" || lower === "backup") return <FileDown className="size-3.5" />;
  if (lower === "login_failed") return <AlertTriangle className="size-3.5" />;
  if (lower.includes("joint")) return <Shield className="size-3.5" />;
  return <Activity className="size-3.5" />;
}

function getActionColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower === "login") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (lower === "logout") return "bg-slate-100 text-slate-600 border-slate-200";
  if (lower === "create" || lower === "approve") return "bg-sky-100 text-sky-700 border-sky-200";
  if (lower === "update") return "bg-amber-100 text-amber-700 border-amber-200";
  if (lower === "delete" || lower === "suspend") return "bg-rose-100 text-rose-700 border-rose-200";
  if (lower === "view" || lower.startsWith("view_")) return "bg-violet-100 text-violet-600 border-violet-200";
  if (lower === "export" || lower === "backup") return "bg-cyan-100 text-cyan-700 border-cyan-200";
  if (lower === "reject") return "bg-orange-100 text-orange-700 border-orange-200";
  if (lower === "login_failed") return "bg-red-100 text-red-700 border-red-200";
  if (lower.includes("joint")) return "bg-purple-100 text-purple-700 border-purple-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function formatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function parseUserAgent(ua: string): string {
  if (!ua) return "";
  // Extract browser
  let browser = "";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";
  else browser = "Other";
  // Extract OS
  let os = "";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  return `${browser} on ${os}`;
}

// ── Component ──

export default function SuperAuditLogsPage() {
  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Data
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [stats, setStats] = useState<AuditStats>({ totalUsers: 0, totalLogs: 0, todayLogs: 0, uniqueUsersToday: 0 });

  // Expanded user detail logs
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [detailLogs, setDetailLogs] = useState<DetailLog[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // ── Fetch grouped user summaries ──
  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);
      if (roleFilter) params.set("role", roleFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
        setTotalPages(data.totalPages ?? 1);
        setStats({
          totalUsers: data.totalUsers ?? 0,
          totalLogs: data.totalLogs ?? 0,
          todayLogs: data.todayLogs ?? 0,
          uniqueUsersToday: data.uniqueUsersToday ?? 0,
        });
      } else {
        toast.error("Failed to fetch audit logs");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, actionFilter, roleFilter, dateFrom, dateTo]);

  // ── Fetch detail logs for expanded user ──
  const fetchDetailLogs = useCallback(async (userId: string, pageNum = 1) => {
    setDetailLoading(true);
    setDetailPage(pageNum);
    try {
      const params = new URLSearchParams({
        expandUser: userId,
        page: String(pageNum),
        limit: "50",
      });
      if (actionFilter) params.set("action", actionFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDetailLogs(data.logs ?? []);
        setDetailTotal(data.total ?? 0);
      }
    } catch {
      toast.error("Failed to load user activity");
    } finally {
      setDetailLoading(false);
    }
  }, [actionFilter, dateFrom, dateTo]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Toggle user expand ──
  const handleToggleExpand = (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setDetailLogs([]);
    } else {
      setExpandedUser(userId);
      fetchDetailLogs(userId, 1);
    }
  };

  // Apply search
  const handleSearch = () => {
 setSearch(searchInput);
 setPage(1);
 setExpandedUser(null);
 };

  // Reset filters
  const handleReset = () => {
 setSearch(""); setSearchInput("");
 setActionFilter(""); setRoleFilter("");
 setDateFrom(""); setDateTo("");
 setPage(1); setExpandedUser(null);
 };

  const hasFilters = search || actionFilter || roleFilter || dateFrom || dateTo;

  // ── Detail pagination ──
  const detailTotalPages = Math.max(1, Math.ceil(detailTotal / 50));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Activity Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor all user login, logout, and system activity. Click a user row to expand their full activity history.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchUsers(true)} disabled={refreshing}>
          <RefreshCw className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Users className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
                <Activity className="size-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <LogIn className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.todayLogs}</p>
                <p className="text-xs text-muted-foreground">Actions Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                <Shield className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniqueUsersToday}</p>
                <p className="text-xs text-muted-foreground">Active Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name, action, IP, provider..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === "ALL" ? "" : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All Roles" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="SUPERUSER">System Admin</SelectItem>
                  <SelectItem value="OPERATOR">Owner</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="POLICE">Police</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Action</label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "ALL" ? "" : v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                  <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="APPROVE">Approve</SelectItem>
                  <SelectItem value="REJECT">Reject</SelectItem>
                  <SelectItem value="SUSPEND">Suspend</SelectItem>
                  <SelectItem value="EXPORT">Export</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            </div>
            <div className="w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSearch}>
                <Search className="size-3.5 mr-1.5" /> Search
              </Button>
              {hasFilters && (
                <Button size="sm" variant="ghost" onClick={handleReset}>
                  <X className="size-3.5 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="size-4" />
            Users — {stats.totalUsers} users with activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-60" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No audit activity found</p>
              <p className="text-xs text-muted-foreground/70">Activity will appear here once users start using the system.</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user) => {
                const isExpanded = expandedUser === user.userId;
                return (
                  <div key={user.userId}>
                    {/* User Row — clickable to expand */}
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(user.userId)}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 ${isExpanded ? "bg-slate-50" : ""}`}
                    >
                      {/* Expand/Collapse Icon */}
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isExpanded ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                        {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </div>

                      {/* User Avatar Initials */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                        user.userRole === "SUPERUSER" ? "bg-purple-500" :
                        user.userRole === "POLICE" ? "bg-emerald-600" :
                        user.userRole === "OPERATOR" ? "bg-blue-500" : "bg-sky-500"
                      }`}>
                        {user.userName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{user.userName || "Unknown"}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getRoleBadge(user.userRole)}`}>
                            {getRoleLabel(user.userRole)}
                          </Badge>
                          {user.userRole === "POLICE" && user.officerName && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600 border-emerald-200">
                              {user.officerName}
                            </Badge>
                          )}
                        </div>
                        {user.providerName && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {user.providerName}
                          </p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="hidden md:flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold">{user.totalActions}</p>
                          <p className="text-[10px] text-muted-foreground">Actions</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{user.lastIp || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">Last IP</p>
                        </div>
                        <div className="text-right min-w-[120px]">
                          <p className="text-sm">{formatShortDate(user.lastActivity)}</p>
                          <p className="text-[10px] text-muted-foreground">Last Active</p>
                        </div>
                      </div>

                      {/* Mobile-only action count */}
                      <div className="md:hidden flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{user.totalActions} actions</Badge>
                      </div>
                    </button>

                    {/* Expanded Detail Logs */}
                    {isExpanded && (
                      <div className="border-t bg-slate-50/50 px-4 py-3">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-sm font-semibold">
                            Activity for {user.userName}
                          </h3>
                          <Badge variant="outline" className="text-[10px]">
                            {user.lastLogin ? `Last login: ${formatShortDate(user.lastLogin)}` : "No login recorded"}
                          </Badge>
                        </div>

                        {detailLoading ? (
                          <div className="space-y-2 py-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <Skeleton key={i} className="h-10 w-full" />
                            ))}
                          </div>
                        ) : detailLogs.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">No activity found for this user with current filters.</p>
                        ) : (
                          <>
                            <div className="rounded-lg border bg-white overflow-hidden">
                              {/* Desktop Table */}
                              <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b bg-slate-50">
                                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground w-8">#</th>
                                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Action</th>
                                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Details</th>
                                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">IP Address</th>
                                      <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Device / Browser</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {detailLogs.map((log, idx) => (
                                      <tr key={log.id} className="hover:bg-slate-50/50">
                                        <td className="py-2 px-3 text-xs text-muted-foreground">
                                          {(detailPage - 1) * 50 + idx + 1}
                                        </td>
                                        <td className="py-2 px-3 text-xs whitespace-nowrap">
                                          {formatTimestamp(log.createdAt)}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}>
                                            {getActionIcon(log.action)}
                                            {log.action}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-xs max-w-[300px] truncate" title={log.details || ""}>
                                          {log.details || "—"}
                                        </td>
                                        <td className="py-2 px-3 text-xs font-mono text-muted-foreground">
                                          {log.ipAddress || "—"}
                                        </td>
                                        <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                                          <span className="inline-flex items-center gap-1">
                                            <Monitor className="size-3" />
                                            {parseUserAgent(log.userAgent)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Mobile Cards */}
                              <div className="lg:hidden divide-y">
                                {detailLogs.map((log) => (
                                  <div key={log.id} className="p-3 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}>
                                        {getActionIcon(log.action)}
                                        {log.action}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">{formatShortDate(log.createdAt)}</span>
                                    </div>
                                    {log.details && <p className="text-xs text-slate-600">{log.details}</p>}
                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                      {log.ipAddress && (
                                        <span className="inline-flex items-center gap-1">
                                          <Globe className="size-3" /> {log.ipAddress}
                                        </span>
                                      )}
                                      {log.userAgent && (
                                        <span className="inline-flex items-center gap-1">
                                          <Monitor className="size-3" /> {parseUserAgent(log.userAgent)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Detail Pagination */}
                            {detailTotalPages > 1 && (
                              <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-muted-foreground">
                                  Showing {(detailPage - 1) * 50 + 1}–{Math.min(detailPage * 50, detailTotal)} of {detailTotal} entries
                                </p>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline" size="sm"
                                    disabled={detailPage <= 1}
                                    onClick={() => fetchDetailLogs(user.userId, detailPage - 1)}
                                  >
                                    <ChevronLeft className="size-3.5" />
                                  </Button>
                                  <span className="text-xs px-2">Page {detailPage} / {detailTotalPages}</span>
                                  <Button
                                    variant="outline" size="sm"
                                    disabled={detailPage >= detailTotalPages}
                                    onClick={() => fetchDetailLogs(user.userId, detailPage + 1)}
                                  >
                                    <ChevronRight className="size-3.5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({stats.totalUsers} users)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="size-3.5 mr-1" /> Prev
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline" size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next <ChevronRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
