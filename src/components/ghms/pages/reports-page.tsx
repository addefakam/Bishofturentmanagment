"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { useAppStore } from "@/lib/store";
import { apiGetReports } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DollarSign,
  TrendingDown,
  TrendingUp,
  Percent,
  Download,
  BarChart3,
  CalendarDays,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  Mail,
  CreditCard,
  Globe,
  MapPin,
  FileText,
  Star,
  UserCheck,
} from "lucide-react";

interface Reservation {
  id: string;
  status: string;
  paidAmount: number;
  checkIn: string;
  checkOut: string;
  guest: {
    id: string;
    name: string;
    phone: string;
    email: string;
    idNumber: string;
    idType: string;
    nationality: string;
    address: string;
    notes: string;
    vip: boolean;
    createdAt: string;
  };
  room: { number: string; name: string; type: string };
}

interface ExpenseBreakdownItem {
  category: string;
  amount: number;
}

interface DailyRevenueItem {
  date: string;
  amount: number;
}

interface ReportData {
  revenue: number;
  expenses: number;
  profit: number;
  occupancyRate: number;
  reservations: Reservation[];
  activeGuests: Reservation[];
  expenseBreakdown: ExpenseBreakdownItem[];
  dailyRevenue: DailyRevenueItem[];
}

const EXPENSE_COLORS = [
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-orange-500",
];

const STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-blue-100 text-blue-700 border-blue-200",
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ReportsPage() {
  const { refreshKey } = useAppStore();
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuests, setShowGuests] = useState(false);
  const [showActiveGuests, setShowActiveGuests] = useState(false);
  const [activeGuestSearch, setActiveGuestSearch] = useState();
  const [expandedActiveIdx, setExpandedActiveIdx] = useState<number | null>(null);
  const [expandedGuestIdx, setExpandedGuestIdx] = useState<number | null>(null);
  const [guestSearch, setGuestSearch] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const result = await apiGetReports(params.toString());
      setData(result);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports, refreshKey]);

  const statusBreakdown = useMemo(() => {
    if (!data?.reservations) return [];
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of data.reservations) {
      const existing = map.get(r.status) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += r.paidAmount;
      map.set(r.status, existing);
    }
    return Array.from(map.entries()).map(([status, info]) => ({
      status,
      ...info,
    }));
  }, [data]);

  const maxDailyRevenue = useMemo(() => {
    if (!data?.dailyRevenue?.length) return 0;
    return Math.max(...data.dailyRevenue.map((d) => d.amount), 1);
  }, [data]);

  const maxExpenseCategory = useMemo(() => {
    if (!data?.expenseBreakdown?.length) return 0;
    return Math.max(...data.expenseBreakdown.map((e) => e.amount), 1);
  }, [data]);

  // Unique guests served in the period
  const servedGuests = useMemo(() => {
    if (!data?.reservations?.length) return [];
    const map = new Map<string, {
      guestId: string;
      name: string;
      phone: string;
      email: string;
      idNumber: string;
      idType: string;
      nationality: string;
      address: string;
      notes: string;
      vip: boolean;
      guestSince: string;
      visits: number;
      totalSpent: number;
      lastVisit: string;
      rooms: { number: string; name: string; type: string; checkIn: string; checkOut: string; status: string }[];
    }>();
    for (const r of data.reservations.filter((r: { status: string }) => r.status === "COMPLETED")) {
      const g = r.guest;
      const key = g?.id || g?.name || r.guestId || "unknown";
      const existing = map.get(key) || {
        guestId: g?.id || "",
        name: g?.name || "Unknown",
        phone: g?.phone || "",
        email: g?.email || "",
        idNumber: g?.idNumber || "",
        idType: g?.idType || "",
        nationality: g?.nationality || "",
        address: g?.address || "",
        notes: g?.notes || "",
        vip: g?.vip || false,
        guestSince: g?.createdAt || "",
        visits: 0,
        totalSpent: 0,
        lastVisit: "",
        rooms: [],
      };
      existing.visits += 1;
      existing.totalSpent += r.paidAmount;
      if (r.checkIn > existing.lastVisit) existing.lastVisit = r.checkIn;
      existing.rooms.push({
        number: r.room?.number || "",
        name: r.room?.name || "",
        type: r.room?.type || "",
        checkIn: r.checkIn || "",
        checkOut: r.checkOut || "",
        status: r.status || "",
      });
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
  }, [data]);
  const filteredServedGuests = useMemo(() => {
    if (!guestSearch) return servedGuests;
    const q = guestSearch.toLowerCase();
    return servedGuests.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.phone.toLowerCase().includes(q) ||
      g.idNumber.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.nationality.toLowerCase().includes(q)
    );
  }, [servedGuests, guestSearch]);
  // Active guests (OCCUPIED + RESERVED) in the period
  const activeGuests = useMemo(() => {
    if (!data?.activeGuests?.length) return [];
    const map = new Map();
    for (const r of data.activeGuests) {
      const g = r.guest;
      map.set(r.id, {
        reservationId: r.id,
        guestId: g?.id || "",
        name: g?.name || "Unknown",
        phone: g?.phone || "",
        email: g?.email || "",
        idNumber: g?.idNumber || "",
        idType: g?.idType || "",
        nationality: g?.nationality || "",
        address: g?.address || "",
        notes: g?.notes || "",
        vip: g?.vip || false,
        roomNumber: r.room?.number || "",
        roomName: r.room?.name || "",
        roomType: r.room?.type || "",
        status: r.status,
        checkIn: r.checkIn || "",
        checkOut: r.checkOut || "",
        paidAmount: r.paidAmount || 0,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
      if (a.status !== "ACTIVE" && b.status === "ACTIVE") return 1;
      return a.checkIn.localeCompare(b.checkIn);
    });
  }, [data]);
  const filteredActiveGuests = useMemo(() => {
    if (!activeGuestSearch) return activeGuests;
    const q = activeGuestSearch.toLowerCase();
    return activeGuests.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.phone.toLowerCase().includes(q) ||
      g.idNumber.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.roomNumber.toLowerCase().includes(q)
    );
  }, [activeGuests, activeGuestSearch]);
  const handleExport = () => {
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${from}-to-${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            View financial summaries and analytics.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={showActiveGuests ? "default" : "outline"} onClick={() => setShowActiveGuests(!showActiveGuests)} disabled={loading || !data}>
            <UserCheck className="mr-2 h-4 w-4" />
            Active Guests ({activeGuests.length})
          </Button>
          <Button variant={showGuests ? "default" : "outline"} onClick={() => setShowGuests(!showGuests)} disabled={loading || !data}>
            <Users className="mr-2 h-4 w-4" />
            Served Guests ({servedGuests.length})
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={loading || !data}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Date Range Picker */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-end gap-4 pt-6">
          <div className="grid gap-2 flex-1 w-full sm:w-auto">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2 flex-1 w-full sm:w-auto">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button onClick={fetchReports} disabled={loading}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Apply
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Active Guests Section */}
          {showActiveGuests && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Active & Upcoming Guests
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by name, ID, phone, room..."
                    value={activeGuestSearch}
                    onChange={(e) => setActiveGuestSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredActiveGuests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No active or upcoming guests in this period.
                  </p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {filteredActiveGuests.map((g, i) => (
                        <div key={g.reservationId}>
                          <div
                            className="rounded-lg border p-3 space-y-2 cursor-pointer"
                            onClick={() => setExpandedActiveIdx(expandedActiveIdx === i ? null : i)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={"flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm shrink-0 " + (g.status === "ACTIVE" ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600")}>
                                  {g.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-sm">{g.name}</p>
                                    {g.vip && <Star className="inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                                  </div>
                                  {g.phone && <p className="text-xs text-muted-foreground">{g.phone}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={STATUS_COLORS[g.status] || ""}>{g.status}</Badge>
                                {expandedActiveIdx === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Room {g.roomNumber}{g.roomName ? ' ' + g.roomName : ''}</span>
                              <span className="font-medium">{g.checkIn} → {g.checkOut}</span>
                            </div>
                          </div>
                          {expandedActiveIdx === i && (
                            <div className="mt-2 ml-4 rounded-lg border border-sky-100 bg-sky-50 p-3 space-y-2">
                              {g.email && (
                                <div className="flex items-center gap-2 text-xs"><Mail className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.email}</span></div>
                              )}
                              {(g.idType || g.idNumber) && (
                                <div className="flex items-center gap-2 text-xs"><CreditCard className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.idType}{g.idNumber ? ' · ' + g.idNumber : ""}</span></div>
                              )}
                              {g.nationality && (
                                <div className="flex items-center gap-2 text-xs"><Globe className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.nationality}</span></div>
                              )}
                              {g.address && (
                                <div className="flex items-center gap-2 text-xs"><MapPin className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.address}</span></div>
                              )}
                              {g.notes && (
                                <div className="flex items-start gap-2 text-xs mt-1"><FileText className="h-3.5 w-3.5 text-sky-500 mt-0.5 shrink-0" /><span className="text-sky-700">{g.notes}</span></div>
                              )}
                              {g.paidAmount > 0 && (
                                <div className="flex items-center gap-2 text-xs mt-1"><DollarSign className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">Paid: {formatCurrency(g.paidAmount)}</span></div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border bg-white max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/80">
                            <TableHead>Guest Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Check-In</TableHead>
                            <TableHead>Check-Out</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredActiveGuests.map((g, i) => (
                            <Fragment key={g.reservationId}>
                              <TableRow className="cursor-pointer" onClick={() => setExpandedActiveIdx(expandedActiveIdx === i ? null : i)}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className={"flex h-8 w-8 items-center justify-center rounded-full font-medium text-sm " + (g.status === "ACTIVE" ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600")}>
                                      {g.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-900">{g.name}</span>
                                      {g.vip && <span className="ml-1.5"><Star className="inline h-3.5 w-3.5 fill-amber-400 text-amber-400" /></span>}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-gray-600">{g.phone || "—"}</TableCell>
                                <TableCell className="font-medium">{g.roomNumber}{g.roomName ? ' ' + g.roomName : ""}</TableCell>
                                <TableCell><Badge variant="outline" className={STATUS_COLORS[g.status] || ""}>{g.status}</Badge></TableCell>
                                <TableCell>{g.checkIn}</TableCell>
                                <TableCell>{g.checkOut}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(g.paidAmount)}</TableCell>
                                <TableCell>{expandedActiveIdx === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</TableCell>
                              </TableRow>
                              {expandedActiveIdx === i && (
                                <TableRow className="bg-gray-50/50">
                                  <TableCell colSpan={8}>
                                    <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
                                      {g.email && (
                                        <div className="flex items-start gap-2">
                                          <Mail className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                          <div><p className="text-xs text-gray-500">Email</p><p className="text-sm text-gray-900">{g.email}</p></div>
                                        </div>
                                      )}
                                      {(g.idType || g.idNumber) && (
                                        <div className="flex items-start gap-2">
                                          <CreditCard className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                          <div><p className="text-xs text-gray-500">ID</p><p className="text-sm text-gray-900">{g.idType}{g.idNumber ? ' · ' + g.idNumber : ""}</p></div>
                                        </div>
                                      )}
                                      {g.nationality && (
                                        <div className="flex items-start gap-2">
                                          <Globe className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                          <div><p className="text-xs text-gray-500">Nationality</p><p className="text-sm text-gray-900">{g.nationality}</p></div>
                                        </div>
                                      )}
                                    </div>
                                    {g.address && (
                                      <div className="mt-3 flex items-start gap-2">
                                        <MapPin className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                        <div><p className="text-xs text-gray-500">Address</p><p className="text-sm text-gray-900">{g.address}</p></div>
                                      </div>
                                    )}
                                    {g.notes && (
                                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 p-3 border border-sky-100">
                                        <FileText className="mt-0.5 h-4 w-4 text-sky-500 shrink-0" />
                                        <div><p className="text-xs font-medium text-sky-800">Notes</p><p className="text-sm text-sky-700">{g.notes}</p></div>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      {filteredActiveGuests.length} active guest{filteredActiveGuests.length !== 1 ? "s" : ""} · {activeGuests.filter((g) => g.status === "ACTIVE").length} currently staying · {activeGuests.filter((g) => g.status === "UPCOMING").length} upcoming
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Served Guests Section */}
          {showGuests && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Guests Served ({from} to {to})
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by name, ID, phone, email..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredServedGuests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No guests served in this period.
                  </p>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                      {filteredServedGuests.map((g, i) => (
                        <div key={i}>
                          <div
                            className="rounded-lg border p-3 space-y-2 cursor-pointer"
                            onClick={() => setExpandedGuestIdx(expandedGuestIdx === i ? null : i)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-medium text-sm shrink-0">
                                  {g.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-sm">{g.name}</p>
                                    {g.vip && <Star className="inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                                  </div>
                                  {g.phone && <p className="text-xs text-muted-foreground">{g.phone}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{g.visits} visit{g.visits !== 1 ? "s" : ""}</Badge>
                                {expandedGuestIdx === i ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Last: {g.lastVisit}</span>
                              <span className="font-medium">{formatCurrency(g.totalSpent)}</span>
                            </div>
                          </div>
                          {expandedGuestIdx === i && (
                            <div className="mt-2 ml-4 rounded-lg border border-amber-100 bg-amber-50 p-3 space-y-2">
                              {g.email && (
                                <div className="flex items-center gap-2 text-xs"><Mail className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.email}</span></div>
                              )}
                              {(g.idType || g.idNumber) && (
                                <div className="flex items-center gap-2 text-xs"><CreditCard className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.idType}{g.idNumber ? ` · ${g.idNumber}` : ""}</span></div>
                              )}
                              {g.nationality && (
                                <div className="flex items-center gap-2 text-xs"><Globe className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.nationality}</span></div>
                              )}
                              {g.address && (
                                <div className="flex items-center gap-2 text-xs"><MapPin className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-600">{g.address}</span></div>
                              )}
                              {g.notes && (
                                <div className="flex items-start gap-2 text-xs mt-1"><FileText className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" /><span className="text-amber-700">{g.notes}</span></div>
                              )}
                              {g.guestSince && (
                                <p className="text-[10px] text-gray-400 mt-1">Guest since {new Date(g.guestSince).toLocaleDateString()}</p>
                              )}
                              {g.rooms.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-amber-200">
                                  <p className="text-[10px] font-medium text-gray-500 mb-1">Room History ({g.rooms.length})</p>
                                  {g.rooms.map((rm, ri) => (
                                    <div key={ri} className="flex items-center justify-between text-xs py-0.5">
                                      <span className="text-gray-600">{rm.number}{rm.name ? ` · ${rm.name}` : ""}</span>
                                      <span className="text-gray-400">{rm.checkIn} → {rm.checkOut}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block rounded-xl border bg-white max-h-[500px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/80">
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Guest Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>ID Number</TableHead>
                            <TableHead>Nationality</TableHead>
                            <TableHead className="text-center">VIP</TableHead>
                            <TableHead className="text-center">Visits</TableHead>
                            <TableHead>Last Visit</TableHead>
                            <TableHead className="text-right">Total Spent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredServedGuests.map((g, i) => (
                            <Fragment key={i}>
                              <TableRow
                                className="cursor-pointer"
                                onClick={() => setExpandedGuestIdx(expandedGuestIdx === i ? null : i)}
                              >
                                <TableCell>
                                  {expandedGuestIdx === i ? (
                                    <ChevronUp className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-medium text-sm">
                                      {g.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-900">{g.name}</span>
                                      {g.vip && (
                                        <span className="ml-1.5">
                                          <Star className="inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-gray-600">{g.phone || "—"}</TableCell>
                                <TableCell className="text-gray-600 text-xs">{g.idNumber || "—"}</TableCell>
                                <TableCell className="text-gray-600">{g.nationality || "—"}</TableCell>
                                <TableCell className="text-center">
                                  {g.vip ? (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                                      <Star className="mr-1 h-3 w-3 fill-amber-500 text-amber-500" />
                                      VIP
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="text-xs">{g.visits}</Badge>
                                </TableCell>
                                <TableCell>{g.lastVisit}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(g.totalSpent)}</TableCell>
                              </TableRow>
                              {/* Expanded details row */}
                              {expandedGuestIdx === i && (
                                <TableRow className="bg-gray-50/50">
                                  <TableCell colSpan={9}>
                                    <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                                      <div className="flex items-start gap-2">
                                        <Mail className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                        <div>
                                          <p className="text-xs text-gray-500">Email</p>
                                          <p className="text-sm text-gray-900">{g.email || "—"}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <CreditCard className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                        <div>
                                          <p className="text-xs text-gray-500">ID Type / Number</p>
                                          <p className="text-sm text-gray-900">
                                            {g.idType}{g.idNumber ? ` · ${g.idNumber}` : ""}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <Globe className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                        <div>
                                          <p className="text-xs text-gray-500">Nationality</p>
                                          <p className="text-sm text-gray-900">{g.nationality || "—"}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-start gap-2">
                                        <MapPin className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                                        <div>
                                          <p className="text-xs text-gray-500">Address</p>
                                          <p className="text-sm text-gray-900">{g.address || "—"}</p>
                                        </div>
                                      </div>
                                    </div>
                                    {g.notes && (
                                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 border border-amber-100">
                                        <FileText className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                                        <div>
                                          <p className="text-xs font-medium text-amber-800">Notes</p>
                                          <p className="text-sm text-amber-700">{g.notes}</p>
                                        </div>
                                      </div>
                                    )}
                                    {g.rooms.length > 0 && (
                                      <div className="mt-3 rounded-lg border p-3">
                                        <p className="text-xs font-medium text-gray-500 mb-2">Room History ({g.rooms.length} stay{g.rooms.length !== 1 ? "s" : ""})</p>
                                        <div className="space-y-1">
                                          {g.rooms.map((rm, ri) => (
                                            <div key={ri} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                                              <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">{rm.number}</span>
                                                {rm.name && <span className="text-gray-400 text-xs">{rm.name}</span>}
                                                {rm.type && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{rm.type}</Badge>}
                                              </div>
                                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span>{rm.checkIn} → {rm.checkOut}</span>
                                                <Badge variant="outline" className={STATUS_COLORS[rm.status] || ""}>{rm.status.replace(/_/g, " ")}</Badge>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {g.guestSince && (
                                      <p className="mt-3 text-xs text-gray-400">
                                        Guest since {new Date(g.guestSince).toLocaleDateString()}
                                      </p>
                                    )}
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                      {filteredServedGuests.length} unique guest{servedGuests.length !== 1 ? "s" : ""} served · Total spent: {formatCurrency(filteredServedGuests.reduce((s, g) => s + g.totalSpent, 0))}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(data.revenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-rose-600">{formatCurrency(data.expenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Profit
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${data.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {formatCurrency(data.profit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Occupancy
                </CardTitle>
                <Percent className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.occupancyRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue vs Expenses Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Revenue vs Expenses (Daily)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.dailyRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No daily data available for this range.
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                  {data.dailyRevenue.map((d) => (
                    <div key={d.date} className="flex items-center gap-3 text-sm">
                      <span className="w-24 shrink-0 text-muted-foreground truncate">
                        {d.date}
                      </span>
                      <div className="flex-1 flex items-center gap-1">
                        <div
                          className="h-5 rounded bg-emerald-500 transition-all"
                          style={{
                            width: `${Math.max((d.amount / maxDailyRevenue) * 100, 2)}%`,
                          }}
                          title={`Revenue: ${formatCurrency(d.amount)}`}
                        />
                      </div>
                      <span className="w-20 text-right font-medium">
                        {formatCurrency(d.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>


          {/* Expense Breakdown + Reservation Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Expense Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {data.expenseBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No expenses recorded.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.expenseBreakdown.map((item, i) => (
                      <div key={item.category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.category}</span>
                          <span>{formatCurrency(item.amount)}</span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-muted">
                          <div
                            className={`h-3 rounded-full ${EXPENSE_COLORS[i % EXPENSE_COLORS.length]}`}
                            style={{
                              width: `${(item.amount / maxExpenseCategory) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reservations Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Reservations by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No reservations in this period.
                  </p>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Count</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusBreakdown.map((row) => (
                          <TableRow key={row.status}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={STATUS_COLORS[row.status] || ""}
                              >
                                {row.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{row.count}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(row.revenue)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Daily Revenue Trend Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {data.dailyRevenue.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No daily data available.
                </p>
              ) : (
                <div className="rounded-lg border max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.dailyRevenue.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell>{d.date}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(d.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BarChart3 className="mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">No report data</p>
          <p className="text-sm">Select a date range and click Apply.</p>
        </div>
      )}
    </div>
  );
}