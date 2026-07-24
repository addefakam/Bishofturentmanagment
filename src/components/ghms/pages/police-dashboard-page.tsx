"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useAppStore } from "@/lib/store";
import { apiPoliceDashboard, apiGetSuspectMatches } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  CheckCircle2,
  Clock,
  DoorOpen,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

interface DashboardData {
  totalProviders: number;
  totalRooms: number;
  totalGuests: number;
  activeReservations: number;
  revenue: number;
  providers: ProviderBreakdown[];
}

interface ProviderBreakdown {
  id: string;
  name: string;
  status: string;
  rooms: number;
  guests: number;
  totalReservations: number;
  activeReservations: number;
  revenue: number;
}

interface Provider {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  PENDING: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200",
  REJECTED: "bg-red-100 text-red-800 hover:bg-red-100 border-red-200",
  SUSPENDED: "bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200",
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  PENDING: "Pending",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PoliceDashboardPage() {
  const { refreshKey } = useAppStore();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [loading, setLoading] = useState(true);

  const providerPagination = usePagination({ totalItems: dashboard?.providers?.length || 0, initialPageSize: 10, pageSizeOptions: [5, 10, 20, 50] });
  const paginatedProviders = useMemo(() => providerPagination.paginate(dashboard?.providers || []), [dashboard?.providers, providerPagination]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashData, alertData] = await Promise.all([
        apiPoliceDashboard(),
        apiGetSuspectMatches("unread=true").catch(() => ({ unreadCount: 0 })),
      ]);

      setDashboard(dashData);
      setUnreadAlerts(alertData?.unreadCount || 0);
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

  const kpiCards = dashboard
    ? [
        {
          title: "Providers",
          value: dashboard.totalProviders,
          icon: Building2,
          color: "text-slate-600",
          bg: "bg-slate-100",
        },
        {
          title: "Approved",
          value: dashboard.providers.filter((p) => p.status === "APPROVED").length,
          icon: CheckCircle2,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
        },
        {
          title: "Pending",
          value: dashboard.providers.filter((p) => p.status === "PENDING").length,
          icon: Clock,
          color: "text-yellow-600",
          bg: "bg-yellow-50",
        },
        {
          title: "Rooms",
          value: dashboard.totalRooms,
          icon: DoorOpen,
          color: "text-sky-600",
          bg: "bg-sky-50",
        },
        {
          title: "Active",
          value: dashboard.activeReservations,
          icon: Users,
          color: "text-violet-600",
          bg: "bg-violet-50",
        },
        {
          title: "Revenue",
          value: formatCurrency(dashboard.revenue),
          icon: DollarSign,
          color: "text-emerald-600",
          bg: "bg-emerald-50",
        },
        {
          title: "Suspect Alerts",
          value: unreadAlerts,
          icon: ShieldAlert,
          color: unreadAlerts > 0 ? "text-red-600" : "text-slate-600",
          bg: unreadAlerts > 0 ? "bg-red-50" : "bg-slate-100",
        },
      ]
    : [];

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* KPI Cards — 2 cols on mobile, 3 on tablet, 6 on desktop */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-7">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-7 w-14" />
                </CardContent>
              </Card>
            ))
          : kpiCards.map((kpi) => (
              <Card key={kpi.title} className="shadow-sm">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
                      <kpi.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${kpi.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] sm:text-xs text-muted-foreground">{kpi.title}</p>
                      <p className={`text-sm sm:text-lg font-bold leading-tight ${kpi.color}`}>{kpi.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Provider Overview — Cards on mobile, Table on md+ */}
      <Card className="shadow-sm">
        <CardHeader className="px-4 pb-2 sm:px-6 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            Provider Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4 sm:p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full sm:h-10" />
              ))}
            </div>
          ) : !dashboard?.providers.length ? (
            <div className="flex flex-col items-center py-10 sm:py-12 text-center">
              <AlertCircle className="mb-2 h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/40" />
              <p className="text-xs sm:text-sm text-muted-foreground">No provider data available</p>
            </div>
          ) : (
            <>
              {/* Pagination Controls */}
              <div className="px-3 sm:px-6">
                <PaginationControls
                  currentPage={providerPagination.currentPage}
                  totalPages={providerPagination.totalPages}
                  pageSize={providerPagination.pageSize}
                  pageSizeOptions={providerPagination.pageSizeOptions}
                  totalItems={dashboard.providers.length}
                  rangeInfo={providerPagination.rangeInfo}
                  goToPage={providerPagination.goToPage}
                  setPageSize={providerPagination.setPageSize}
                />
              </div>

              {/* Mobile: Card layout */}
              <div className="space-y-2 p-3 sm:hidden">
                {paginatedProviders.map((p) => (
                  <div key={p.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{p.name}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <DoorOpen className="h-3 w-3" /> {p.rooms} rooms
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {p.activeReservations} active
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className={`shrink-0 text-[10px] ${STATUS_BADGE_CLASS[p.status] || ""}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t pt-2">
                      <span className="text-[10px] text-muted-foreground">Monthly Revenue</span>
                      <span className="text-xs font-semibold text-emerald-600">{formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Rooms</TableHead>
                      <TableHead className="text-center">Active Reservations</TableHead>
                      <TableHead className="text-right">Monthly Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProviders.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={STATUS_BADGE_CLASS[p.status] || ""}>
                            {STATUS_LABELS[p.status] || p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{p.rooms}</TableCell>
                        <TableCell className="text-center">
                          <span className={p.activeReservations > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                            {p.activeReservations}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}