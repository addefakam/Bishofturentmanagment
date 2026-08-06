"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { apiPoliceReports, apiPoliceRoomAvailability } from "@/lib/api";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Users,
  BedDouble,
  Banknote,
  ShieldAlert,
  Footprints,
  FileDown,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Building2,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Types ──
type ReportType =
  | "guest-registration"
  | "occupancy"
  | "revenue"
  | "provider-compliance"
  | "suspicious-activity"
  | "guest-movement";

interface ReportConfig {
  key: ReportType;
  label: string;
  icon: React.ElementType;
  description: string;
}

const REPORT_TYPES: ReportConfig[] = [
  {
    key: "guest-registration",
    label: "Guest Registration",
    icon: Users,
    description: "Registration trends by provider, nationality, gender, and daily activity",
  },
  {
    key: "occupancy",
    label: "Occupancy Analysis",
    icon: BedDouble,
    description: "Room occupancy rates, check-in/out trends, and room status breakdown",
  },
  {
    key: "revenue",
    label: "Revenue & Payments",
    icon: Banknote,
    description: "Payment method analysis, revenue trends, and large cash transaction tracking",
  },
  {
    key: "provider-compliance",
    label: "Provider Compliance",
    icon: Building2,
    description: "Provider licensing status, room/guest counts, and suspension records",
  },
  {
    key: "suspicious-activity",
    label: "Suspicious Activity",
    icon: ShieldAlert,
    description: "Anomaly records, suspect matches, severity breakdowns, and unreviewed items",
  },
  {
    key: "guest-movement",
    label: "Guest Movement",
    icon: Footprints,
    description: "Cross-provider guests, frequent stayers, short-stay patterns, and regional analysis",
  },
];

// ── Chart Colors ──
const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#e11d48",
  "#a855f7",
  "#22c55e",
  "#0ea5e9",
];

const SEVERITY_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#7c2d12",
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#22c55e",
  PENDING: "#f59e0b",
  REJECTED: "#ef4444",
  SUSPENDED: "#7c2d12",
  UPCOMING: "#3b82f6",
  ACTIVE: "#10b981",
  COMPLETED: "#6b7280",
  CANCELLED: "#ef4444",
};

export default function PoliceReportsPage() {
  const { refreshKey } = useAppStore();
  const [activeReport, setActiveReport] = useState<ReportType>("guest-registration");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState("");

  // Fetch providers for filter
  useEffect(() => {
    apiPoliceRoomAvailability()
      .then((res: Record<string, unknown>) => {
        const provs = (res.providers as { id: string; name: string }[]) || [];
        setProviders(provs);
      })
      .catch(() => {});
  }, []);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiPoliceReports({
        type: activeReport,
        dateFrom,
        dateTo,
        providerId: selectedProvider,
      });
      setData(result as Record<string, unknown>);
      setGeneratedAt((result as Record<string, unknown>).generatedAt as string || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [activeReport, dateFrom, dateTo, selectedProvider, refreshKey]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const summary = (data?.summary || {}) as Record<string, number>;
  const currentConfig = REPORT_TYPES.find((r) => r.key === activeReport)!;
  const Icon = currentConfig.icon;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Police Reports & Statistics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and analyze system-wide statistics across all guesthouses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-xs text-gray-400">
              Generated: {new Date(generatedAt).toLocaleString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {REPORT_TYPES.map((rt) => {
          const RIcon = rt.icon;
          const isActive = activeReport === rt.key;
          return (
            <button
              key={rt.key}
              onClick={() => setActiveReport(rt.key)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center cursor-pointer ${
                isActive
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 bg-white text-gray-600"
              }`}
            >
              <RIcon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
              <span className="text-xs font-semibold leading-tight">{rt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Providers</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={fetchReport} disabled={loading} className="h-9">
              <BarChart3 className="w-4 h-4 mr-1" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <SummaryCards reportType={activeReport} summary={summary} />
      )}

      {/* Report Content */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      ) : data ? (
        <ReportContent reportType={activeReport} data={data} />
      ) : (
        <Card className="p-12 text-center text-gray-400">
          Select a report type and click Generate
        </Card>
      )}
    </div>
  );
}

// ── Summary Cards Component ──
function SummaryCards({
  reportType,
  summary,
}: {
  reportType: ReportType;
  summary: Record<string, number>;
}) {
  const cards: { label: string; value: string; color: string; icon: React.ElementType }[] = [];

  switch (reportType) {
    case "guest-registration":
      cards.push(
        { label: "Total Guests", value: fmt(summary.total || 0), color: "blue", icon: Users },
        { label: "Registered Today", value: fmt(summary.todayNew || 0), color: "green", icon: TrendingUp },
        { label: "Providers", value: fmt(summary.providerCount || 0), color: "amber", icon: Building2 },
        { label: "Avg/Day (30d)", value: fmt(summary.avgPerDay || 0), color: "violet", icon: Activity }
      );
      break;
    case "occupancy":
      cards.push(
        { label: "Occupancy Rate", value: `${summary.occupancyRate || 0}%`, color: "blue", icon: BedDouble },
        { label: "Avg Stay", value: `${summary.avgNights || 0} nights`, color: "green", icon: Activity },
        { label: "Total Reservations", value: fmt(summary.totalReservations || 0), color: "amber", icon: TrendingUp },
        { label: "Active Now", value: fmt(summary.activeReservations || 0), color: "violet", icon: Users }
      );
      break;
    case "revenue":
      cards.push(
        { label: "Total Revenue", value: `${fmt(summary.totalRevenue || 0)} ETB`, color: "green", icon: Banknote },
        { label: "Avg Payment", value: `${fmt(summary.avgPayment || 0)} ETB`, color: "blue", icon: Activity },
        { label: "Large Cash (5k+)", value: fmt(summary.largeCashCount || 0), color: "red", icon: AlertTriangle },
        { label: "Large Cash Amt", value: `${fmt(summary.largeCashTotal || 0)} ETB`, color: "amber", icon: Banknote }
      );
      break;
    case "provider-compliance":
      cards.push(
        { label: "Total Providers", value: fmt(summary.totalProviders || 0), color: "blue", icon: Building2 },
        { label: "Total Rooms", value: fmt(summary.totalRooms || 0), color: "green", icon: BedDouble },
        { label: "Total Guests", value: fmt(summary.totalGuests || 0), color: "amber", icon: Users },
        { label: "Suspended", value: fmt(summary.suspendedCount || 0), color: "red", icon: ShieldAlert }
      );
      break;
    case "suspicious-activity":
      cards.push(
        { label: "Total Anomalies", value: fmt(summary.totalAnomalies || 0), color: "red", icon: ShieldAlert },
        { label: "Unreviewed", value: fmt(summary.unreviewedAnomalies || 0), color: "amber", icon: AlertTriangle },
        { label: "Suspect Matches", value: fmt(summary.totalSuspectMatches || 0), color: "violet", icon: Activity },
        { label: "Active Suspects", value: fmt(summary.activeSuspects || 0), color: "red", icon: ShieldAlert }
      );
      break;
    case "guest-movement":
      cards.push(
        { label: "Cross-Provider", value: fmt(summary.crossProviderGuests || 0), color: "red", icon: Footprints },
        { label: "Frequent Stayers", value: fmt(summary.frequentStayers || 0), color: "amber", icon: Activity },
        { label: "Short-Stay Patterns", value: fmt(summary.shortStayPatterns || 0), color: "violet", icon: TrendingUp },
        { label: "Regions Tracked", value: fmt(summary.regionsCount || 0), color: "blue", icon: Building2 }
      );
      break;
  }

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  const iconColorMap: Record<string, string> = {
    blue: "text-blue-500",
    green: "text-emerald-500",
    amber: "text-amber-500",
    red: "text-red-500",
    violet: "text-violet-500",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c, i) => {
        const CIcon = c.icon;
        return (
          <Card key={i} className={`border ${colorMap[c.color] || ""}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium opacity-70">{c.label}</p>
                  <p className="text-xl font-bold mt-1">{c.value}</p>
                </div>
                <CIcon className={`w-8 h-8 opacity-40 ${iconColorMap[c.color] || ""}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Report Content Router ──
function ReportContent({
  reportType,
  data,
}: {
  reportType: ReportType;
  data: Record<string, unknown>;
}) {
  switch (reportType) {
    case "guest-registration":
      return <GuestRegistrationReport data={data} />;
    case "occupancy":
      return <OccupancyReport data={data} />;
    case "revenue":
      return <RevenueReport data={data} />;
    case "provider-compliance":
      return <ProviderComplianceReport data={data} />;
    case "suspicious-activity":
      return <SuspiciousActivityReport data={data} />;
    case "guest-movement":
      return <GuestMovementReport data={data} />;
  }
}

// ── 1. Guest Registration Report ──
function GuestRegistrationReport({ data }: { data: Record<string, unknown> }) {
  const byProvider = (data.byProvider || []) as { name: string; value: number }[];
  const byNationality = (data.byNationality || []) as { name: string; value: number }[];
  const byGender = (data.byGender || []) as { name: string; value: number }[];
  const dailyTrend = (data.dailyTrend || []) as { date: string; count: number }[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Daily Registration Trend */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Daily Guest Registration Trend (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="New Guests" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Provider */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            Guests by Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byProvider.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Guests" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Nationality + Gender */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">By Nationality</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byNationality.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Guests" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">By Gender</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={byGender}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {byGender.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── 2. Occupancy Report ──
function OccupancyReport({ data }: { data: Record<string, unknown> }) {
  const statusBreakdown = (data.statusBreakdown || []) as { name: string; value: number }[];
  const checkinTrend = (data.checkinTrend || []) as { date: string; count: number }[];
  const checkoutTrend = (data.checkoutTrend || []) as { date: string; count: number }[];
  const roomStatusByProvider = (data.roomStatusByProvider || []) as {
    providerName: string; total: number; available: number; occupied: number; maintenance: number; reserved: number;
  }[];

  // Merge checkin/checkout into single timeline
  const timelineMap = new Map<string, { date: string; checkins: number; checkouts: number }>();
  for (const r of checkinTrend) {
    const existing = timelineMap.get(r.date) || { date: r.date, checkins: 0, checkouts: 0 };
    existing.checkins = r.count;
    timelineMap.set(r.date, existing);
  }
  for (const r of checkoutTrend) {
    const existing = timelineMap.get(r.date) || { date: r.date, checkins: 0, checkouts: 0 };
    existing.checkouts = r.count;
    timelineMap.set(r.date, existing);
  }
  const timeline = [...timelineMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Check-in / Check-out Trend */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Check-in / Check-out Trend (30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="checkins" stroke="#22c55e" strokeWidth={2} dot={false} name="Check-ins" />
              <Line type="monotone" dataKey="checkouts" stroke="#ef4444" strokeWidth={2} dot={false} name="Check-outs" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Reservation Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Reservation Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || COLORS[0]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Room Status by Provider */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Room Status by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[350px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">Provider</th>
                  <th className="text-right py-2 px-1">Total</th>
                  <th className="text-right py-2 px-1 text-green-600">Avail</th>
                  <th className="text-right py-2 px-1 text-blue-600">Occupied</th>
                  <th className="text-right py-2 px-1 text-red-600">Maint</th>
                  <th className="text-right py-2 pl-1">Resvd</th>
                </tr>
              </thead>
              <tbody>
                {roomStatusByProvider.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-1.5 pr-2 font-medium truncate max-w-[140px]">{r.providerName}</td>
                    <td className="text-right py-1.5 px-1">{r.total}</td>
                    <td className="text-right py-1.5 px-1 text-green-600">{r.available}</td>
                    <td className="text-right py-1.5 px-1 text-blue-600">{r.occupied}</td>
                    <td className="text-right py-1.5 px-1 text-red-600">{r.maintenance}</td>
                    <td className="text-right py-1.5 pl-1 text-amber-600">{r.reserved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 3. Revenue Report ──
function RevenueReport({ data }: { data: Record<string, unknown> }) {
  const byMethod = (data.byMethod || []) as { name: string; value: number; count: number }[];
  const byProvider = (data.byProvider || []) as { name: string; value: number; count: number }[];
  const dailyTrend = (data.dailyTrend || []) as { date: string; total: number }[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Daily Revenue Trend */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Daily Revenue Trend (30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ETB`, "Revenue"]} />
              <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue (ETB)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Payment Method */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue by Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={byMethod}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {byMethod.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v.toLocaleString()} ETB`} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Provider */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byProvider.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} ETB`, "Revenue"]} />
              <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Revenue (ETB)" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 4. Provider Compliance Report ──
function ProviderComplianceReport({ data }: { data: Record<string, unknown> }) {
  const statusBreakdown = (data.statusBreakdown || []) as { name: string; value: number }[];
  const providers = (data.providers || []) as {
    id: string; name: string; status: string; phone: string; address: string;
    licenseNo: string; roomCount: number; guestCount: number; userCount: number; createdAt: string;
  }[];
  const suspendedProviders = (data.suspendedProviders || []) as {
    id: string; name: string; reason: string; suspendedAt: string; suspendedBy: string;
  }[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Status Pie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Provider Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusBreakdown}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {statusBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || COLORS[0]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Suspended Providers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-red-600">
            Suspended Providers ({suspendedProviders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suspendedProviders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No suspended providers</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {suspendedProviders.map((sp) => (
                <div key={sp.id} className="border rounded-lg p-3 text-xs">
                  <div className="font-semibold text-red-700">{sp.name}</div>
                  <div className="text-gray-500 mt-1">Reason: {sp.reason || "Not specified"}</div>
                  {sp.suspendedAt && (
                    <div className="text-gray-400 mt-0.5">Suspended: {new Date(sp.suspendedAt).toLocaleDateString()}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Table */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">All Providers Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[400px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b">
                <th className="text-left py-2 pr-3">Name</th>
                <th className="text-left py-2 px-1">Status</th>
                <th className="text-left py-2 px-1">Phone</th>
                <th className="text-left py-2 px-1">License</th>
                <th className="text-right py-2 px-1">Rooms</th>
                <th className="text-right py-2 px-1">Guests</th>
                <th className="text-right py-2 px-1">Users</th>
                <th className="text-left py-2 pl-1">Address</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-1.5 pr-3 font-medium">{p.name}</td>
                  <td className="py-1.5 px-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        p.status === "APPROVED"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : p.status === "SUSPENDED"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : p.status === "PENDING"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-gray-50 text-gray-600 border-gray-200"
                      }`}
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="py-1.5 px-1 text-gray-500">{p.phone}</td>
                  <td className="py-1.5 px-1 text-gray-500">{p.licenseNo || "—"}</td>
                  <td className="text-right py-1.5 px-1">{p.roomCount}</td>
                  <td className="text-right py-1.5 px-1">{p.guestCount}</td>
                  <td className="text-right py-1.5 px-1">{p.userCount}</td>
                  <td className="py-1.5 pl-1 text-gray-400 truncate max-w-[200px]">{p.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 5. Suspicious Activity Report ──
function SuspiciousActivityReport({ data }: { data: Record<string, unknown> }) {
  const anomalyBySeverity = (data.anomalyBySeverity || []) as { name: string; value: number }[];
  const anomalyByType = (data.anomalyByType || []) as { name: string; value: number }[];
  const recentAnomalies = (data.recentAnomalies || []) as Record<string, unknown>[];
  const suspectMatches = (data.suspectMatches || []) as {
    id: string; guestName: string; matchType: string; providerName: string; isRead: boolean; createdAt: string;
  }[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Anomaly by Severity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Anomalies by Severity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={anomalyBySeverity}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {anomalyBySeverity.map((entry) => (
                  <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || COLORS[0]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Anomaly by Type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Anomalies by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={anomalyByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Anomalies Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Anomalies (Top 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[350px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">Severity</th>
                  <th className="text-left py-2 pr-2">Type</th>
                  <th className="text-left py-2 pr-2">Guest</th>
                  <th className="text-left py-2 pr-2">Provider</th>
                  <th className="text-right py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {recentAnomalies.slice(0, 30).map((a, i) => {
                  const sev = String(a.severity || "");
                  return (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-1.5 pr-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            sev === "CRITICAL"
                              ? "bg-red-100 text-red-800"
                              : sev === "HIGH"
                              ? "bg-orange-100 text-orange-800"
                              : sev === "MEDIUM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {sev}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-gray-600">{String(a.type || "").replace(/_/g, " ")}</td>
                      <td className="py-1.5 pr-2 font-medium">{String(a.guestName || "")}</td>
                      <td className="py-1.5 pr-2 text-gray-500">{String(a.providerName || "")}</td>
                      <td className="text-right py-1.5 font-mono">{Number(a.riskScore || 0)}</td>
                    </tr>
                  );
                })}
                {recentAnomalies.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">No anomalies detected</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Suspect Matches Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Recent Suspect Matches (Top 50)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[350px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">Guest Name</th>
                  <th className="text-left py-2 pr-2">Match Type</th>
                  <th className="text-left py-2 pr-2">Provider</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {suspectMatches.slice(0, 30).map((sm) => (
                  <tr key={sm.id} className="border-b hover:bg-gray-50">
                    <td className="py-1.5 pr-2 font-medium">{sm.guestName}</td>
                    <td className="py-1.5 pr-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700">
                        {sm.matchType}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2 text-gray-500">{sm.providerName}</td>
                    <td className="py-1.5 text-gray-400">{sm.createdAt ? new Date(sm.createdAt).toLocaleDateString() : ""}</td>
                  </tr>
                ))}
                {suspectMatches.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No suspect matches</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 6. Guest Movement Report ──
function GuestMovementReport({ data }: { data: Record<string, unknown> }) {
  const crossProviderGuests = (data.crossProviderGuests || []) as {
    phone: string; name: string; providerCount: number; providerNames: string;
  }[];
  const frequentStayers = (data.frequentStayers || []) as {
    guestName: string; guestPhone: string; stayCount: number; providerNames: string;
  }[];
  const shortStayGuests = (data.shortStayGuests || []) as {
    guestName: string; guestPhone: string; stayCount: number; providerNames: string;
  }[];
  const byRegion = (data.byRegion || []) as { name: string; value: number }[];
  const byProvider = (data.byProvider || []) as { name: string; value: number }[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* By Region */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Guests by Region</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byRegion}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Guests" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Provider */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Guests by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byProvider} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Guests" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cross-Provider Guests */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-red-600">
            Cross-Provider Guests ({crossProviderGuests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[350px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">Name</th>
                  <th className="text-left py-2 pr-2">Phone</th>
                  <th className="text-right py-2 pr-2">Providers</th>
                  <th className="text-left py-2">Provider Names</th>
                </tr>
              </thead>
              <tbody>
                {crossProviderGuests.slice(0, 30).map((g, i) => (
                  <tr key={i} className="border-b hover:bg-red-50">
                    <td className="py-1.5 pr-2 font-medium">{g.name}</td>
                    <td className="py-1.5 pr-2 text-gray-600 font-mono">{g.phone}</td>
                    <td className="text-right py-1.5 pr-2">
                      <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0">
                        {g.providerCount}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-gray-500 text-[11px]">{g.providerNames}</td>
                  </tr>
                ))}
                {crossProviderGuests.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-gray-400">No cross-provider guests found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Frequent Stayers + Short Stay */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-600">
              Frequent Stayers (3+ stays) ({frequentStayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[200px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">Name</th>
                    <th className="text-right py-2 pr-2">Stays</th>
                    <th className="text-left py-2">Providers</th>
                  </tr>
                </thead>
                <tbody>
                  {frequentStayers.slice(0, 15).map((g, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-1.5 pr-2 font-medium">{g.guestName}</td>
                      <td className="text-right py-1.5 pr-2 font-mono">{g.stayCount}</td>
                      <td className="py-1.5 text-gray-500">{g.providerNames}</td>
                    </tr>
                  ))}
                  {frequentStayers.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-6 text-gray-400">None found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-violet-600">
              Short-Stay Patterns (1-night, 3+) ({shortStayGuests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[200px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">Name</th>
                    <th className="text-right py-2 pr-2">Count</th>
                    <th className="text-left py-2">Providers</th>
                  </tr>
                </thead>
                <tbody>
                  {shortStayGuests.slice(0, 15).map((g, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-1.5 pr-2 font-medium">{g.guestName}</td>
                      <td className="text-right py-1.5 pr-2 font-mono">{g.stayCount}</td>
                      <td className="py-1.5 text-gray-500">{g.providerNames}</td>
                    </tr>
                  ))}
                  {shortStayGuests.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-6 text-gray-400">None found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Helpers ──
function fmt(n: number): string {
  return n.toLocaleString();
}
