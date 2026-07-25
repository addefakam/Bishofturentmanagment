"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { apiDashboard, apiGetActivity } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DoorOpen,
  TrendingUp,
  CalendarCheck,
  DollarSign,
  Plus,
  LogIn,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Activity,
  UserCheck,
  UserX,
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface DashboardData {
  roomsByStatus: Record<string, number>;
  totalRooms: number;
  activeReservations: number;
  todayCheckins: number;
  todayCheckouts: number;
  totalRevenue: number;
  occupancyRate: number;
}

interface ActivityLog {
  id: string;
  message: string;
  type: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  OCCUPIED: "bg-rose-500",
  MAINTENANCE: "bg-amber-500",
  RESERVED: "bg-sky-500",
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  MAINTENANCE: "Maintenance",
  RESERVED: "Reserved",
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  INFO: <Info className="h-4 w-4 text-sky-500" />,
  SUCCESS: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  WARNING: <AlertCircle className="h-4 w-4 text-amber-500" />,
  ERROR: <XCircle className="h-4 w-4 text-rose-500" />,
};

export default function DashboardPage() {
  const { refreshKey, setCurrentPage } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboardData, activityData] = await Promise.all([
        apiDashboard(),
        apiGetActivity(),
      ]);
      setData(dashboardData);
      setActivity(activityData.slice(0, 15));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const revenueData = [
    { day: "Mon", value: 2800 },
    { day: "Tue", value: 3200 },
    { day: "Wed", value: 1900 },
    { day: "Thu", value: 4100 },
    { day: "Fri", value: 3600 },
    { day: "Sat", value: 4800 },
    { day: "Sun", value: 2500 },
  ];
  const maxRevenue = Math.max(...revenueData.map((d) => d.value));

  const occupancySegments = data
    ? Object.entries(data.roomsByStatus)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          status,
          count,
          pct: data.totalRooms > 0 ? (count / data.totalRooms) * 100 : 0,
          color: STATUS_COLORS[status] || "bg-gray-400",
          label: STATUS_LABELS[status] || status,
        }))
    : [];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(val);

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  const kpis = [
    {
      title: "Total Rooms",
      value: data?.totalRooms ?? 0,
      icon: <DoorOpen className="h-5 w-5" />,
      color: "text-sky-600",
      bg: "bg-sky-50",
      border: "border-sky-100",
    },
    {
      title: "Occupancy Rate",
      value: `${data?.occupancyRate ?? 0}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      subtitle: `${data?.roomsByStatus.OCCUPIED ?? 0} of ${data?.totalRooms ?? 0} rooms`,
    },
    {
      title: "Active Reservations",
      value: data?.activeReservations ?? 0,
      icon: <CalendarCheck className="h-5 w-5" />,
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-100",
      subtitle: `${data?.todayCheckins ?? 0} check-ins today`,
    },
    {
      title: "Monthly Revenue",
      value: formatCurrency(data?.totalRevenue ?? 0),
      icon: <DollarSign className="h-5 w-5" />,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Overview of your guest house performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="gap-0 overflow-hidden py-0">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">{kpi.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                  {kpi.subtitle && (
                    <p className="text-xs text-gray-400">{kpi.subtitle}</p>
                  )}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg} ${kpi.color}`}>
                  {kpi.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-amber-500" />
              Revenue (Last 7 Days)
            </CardTitle>
            <CardDescription>Estimated daily revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2" style={{ height: 180 }}>
              {revenueData.map((item) => (
                <div key={item.day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-500">
                    {formatCurrency(item.value).replace("ETB", "")}
                  </span>
                  <div
                    className="w-full max-w-[48px] rounded-t-md bg-gradient-to-t from-amber-500 to-amber-300 transition-all duration-500 hover:from-amber-600 hover:to-amber-400"
                    style={{
                      height: `${Math.max(8, (item.value / maxRevenue) * 140)}px`,
                    }}
                  />
                  <span className="text-xs text-gray-500">{item.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Room Occupancy
            </CardTitle>
            <CardDescription>Current room status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6">
              {/* Pie Chart (conic-gradient) */}
              <div className="relative">
                <div
                  className="h-40 w-40 rounded-full"
                  style={{
                    background: occupancySegments.length > 0
                      ? `conic-gradient(${occupancySegments.map((s, i) => {
                          const start = occupancySegments.slice(0, i).reduce((acc, seg) => acc + seg.pct, 0);
                          const end = start + s.pct;
                          return `${s.color} ${start}% ${end}%`;
                        }).join(", ")})`
                      : "#e5e7eb",
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white shadow-sm">
                    <span className="text-2xl font-bold text-gray-900">{data?.occupancyRate ?? 0}%</span>
                    <span className="text-xs text-gray-500">Occupied</span>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 gap-3 w-full">
                {occupancySegments.map((seg) => (
                  <div key={seg.status} className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-sm ${seg.color} shrink-0`} />
                    <span className="text-sm text-gray-600">
                      {seg.label}
                    </span>
                    <span className="ml-auto text-sm font-semibold text-gray-900">{seg.count}</span>
                  </div>
                ))}
                {occupancySegments.length === 0 && (
                  <p className="col-span-2 text-center text-sm text-gray-400">No rooms yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Today's Schedule */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-violet-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start gap-3 bg-sky-600 hover:bg-sky-700"
              onClick={() => setCurrentPage("reservations")}
            >
              <Plus className="h-4 w-4" />
              New Reservation
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setCurrentPage("reservations")}
            >
              <LogIn className="h-4 w-4 text-emerald-600" />
              Check-in Guest
              {data && data.todayCheckins > 0 && (
                <Badge variant="secondary" className="ml-auto bg-emerald-50 text-emerald-700">
                  {data.todayCheckins}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setCurrentPage("expenses")}
            >
              <Receipt className="h-4 w-4 text-amber-600" />
              Add Expense
            </Button>
            <Separator className="my-2" />
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setCurrentPage("rooms")}
            >
              <DoorOpen className="h-4 w-4 text-sky-600" />
              View All Rooms
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => setCurrentPage("guests")}
            >
              <UserCheck className="h-4 w-4 text-violet-600" />
              Manage Guests
            </Button>
          </CardContent>
        </Card>

        {/* Today's Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-sky-500" />
              Today&apos;s Schedule
            </CardTitle>
            <CardDescription>Check-ins and check-outs for today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Check-ins */}
              <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-800">
                    {data?.todayCheckins ?? 0} Check-ins Expected
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Guests scheduled to arrive today
                  </p>
                </div>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 border-0">
                  Arrivals
                </Badge>
              </div>

              {/* Check-outs */}
              <div className="flex items-start gap-3 rounded-lg bg-rose-50 p-3 border border-rose-100">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                  <ArrowUpRight className="h-4 w-4 text-rose-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-800">
                    {data?.todayCheckouts ?? 0} Check-outs Expected
                  </p>
                  <p className="text-xs text-rose-600 mt-0.5">
                    Guests scheduled to depart today
                  </p>
                </div>
                <Badge className="bg-rose-600 hover:bg-rose-700 border-0">
                  Departures
                </Badge>
              </div>

              {/* Room Status Summary */}
              <Separator />
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Room Status</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <div key={key} className="text-center rounded-lg border p-2 bg-gray-50/50">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[key]}`} />
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900">
                        {data?.roomsByStatus[key] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-violet-500" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest actions and events</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Activity className="h-8 w-8 mb-2" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-1">
                {activity.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50"
                  >
                    <div className="mt-0.5 shrink-0">
                      {ACTIVITY_ICONS[log.type] || ACTIVITY_ICONS.INFO}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{log.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTimeAgo(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Zap(props: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}