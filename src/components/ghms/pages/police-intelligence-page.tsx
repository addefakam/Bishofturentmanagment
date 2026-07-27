"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { apiPoliceIntelligence, apiPoliceReport } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MapPin, AlertTriangle, BarChart3, Activity, TrendingUp, RefreshCw, FileDown, Loader2,
  Building2, Users, BedDouble, Phone, ShieldAlert, ChevronDown, ChevronUp,
  Globe, Crosshair,
} from "lucide-react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface HotspotItem { providerName: string; providerId: string; matchCount: number; criticalCount: number; highCount: number; lastMatchDate: string | null; address: string; latitude: number; longitude: number; guestCount: number; roomCount: number; hasCoordinates: boolean; }
interface ProviderLocation { id: string; name: string; address: string; latitude: number; longitude: number; type: string; phone: string; guestCount: number; roomCount: number; matchCount: number; criticalCount: number; highCount: number; hasCoordinates: boolean; }
interface MonthlyItem { month: string; reservations: number; suspectMatches: number; }
interface FreqStayItem { id: string; guestName: string; guestPhone: string; guestIdNumber: string; providerNames: string; stayCount: number; avgDaysBetween: number; riskLevel: string; isReviewed: boolean; createdAt: string; }
interface AuditItem { id: string; officerName: string; action: string; targetId: string | null; targetType: string | null; ipAddress: string | null; createdAt: string; }

const RISK_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function buildYearOptions() {
  const current = new Date().getFullYear();
  const opts: { value: string; label: string }[] = [];
  for (let y = current + 1; y >= current - 3; y--) {
    opts.push({ value: String(y), label: String(y) });
  }
  return opts;
}

const YEAR_OPTIONS = buildYearOptions();

// Severity helpers
function getSeverity(p: { criticalCount: number; highCount: number; matchCount: number }) {
  if (p.criticalCount > 0) return "CRITICAL";
  if (p.highCount > 0) return "HIGH";
  if (p.matchCount > 0) return "MEDIUM";
  return "NONE";
}

function getRiskScore(p: { matchCount: number; criticalCount: number; highCount: number }) {
  return p.matchCount * 1 + p.criticalCount * 5 + p.highCount * 3;
}

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CRITICAL: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200", label: "Critical" },
  HIGH: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200", label: "High" },
  MEDIUM: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200", label: "Medium" },
  NONE: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", label: "No Alerts" },
};

export default function PoliceIntelligencePage() {
  const { refreshKey } = useAppStore();
  const [data, setData] = useState<{ frequentStays: FreqStayItem[]; hotspotData: HotspotItem[]; allProviderLocations: ProviderLocation[]; occupancyCrimeCorrelation: MonthlyItem[]; recentActivity: AuditItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"hotspots" | "charts" | "frequent" | "audit">("hotspots");

  // Hotspot tab state
  const [hotspotFilter, setHotspotFilter] = useState<string>("ALL");
  const [hotspotSearch, setHotspotSearch] = useState("");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1));
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportGenerating, setReportGenerating] = useState(false);
  const reportLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Paginations
  const hotspotPag = usePagination({ totalItems: 0, initialPageSize: 12, pageSizeOptions: [6, 12, 24, 48] });
  const freqPag = usePagination({ totalItems: 0, initialPageSize: 5, pageSizeOptions: [5, 10, 20, 50] });
  const auditPag = usePagination({ totalItems: 0, initialPageSize: 20, pageSizeOptions: [10, 20, 50, 100] });
  const rankingPag = usePagination({ totalItems: 0, initialPageSize: 5, pageSizeOptions: [5, 10, 20, 50] });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiPoliceIntelligence();
      setData(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load intelligence data";
      toast.error(msg);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // Filtered hotspot providers
  const filteredHotspots = (() => {
    if (!data) return [];
    let list = data.allProviderLocations || [];
    if (hotspotFilter !== "ALL") {
      list = list.filter((p) => getSeverity(p) === hotspotFilter);
    }
    if (hotspotSearch.trim()) {
      const q = hotspotSearch.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        p.phone.includes(q)
      );
    }
    return list.sort((a, b) => getRiskScore(b) - getRiskScore(a));
  })();

  // Update paginations when data/filter changes
  useEffect(() => { hotspotPag.setTotalItems(filteredHotspots.length); }, [filteredHotspots.length]);
  useEffect(() => {
    if (data) {
      freqPag.setTotalItems(data.frequentStays.length);
      auditPag.setTotalItems(data.recentActivity.length);
      rankingPag.setTotalItems(data.hotspotData.length);
    }
  }, [data]);

  const paginatedHotspots = hotspotPag.paginate(filteredHotspots);
  const pagFreq = data ? freqPag.paginate(data.frequentStays) : [];
  const pagAudit = data ? auditPag.paginate(data.recentActivity) : [];
  const pagRankings = data ? rankingPag.paginate(data.hotspotData) : [];

  const handleDownloadReport = async () => {
    try {
      setReportGenerating(true);
      const html = await apiPoliceReport(Number(reportMonth), Number(reportYear));
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `police-report-${reportYear}-${reportMonth.padStart(2, "0")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setReportOpen(false);
      toast.success("Report downloaded successfully");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to generate report";
      toast.error(msg);
    } finally {
      setReportGenerating(false);
    }
  };

  // Summary stats
  const hotspotStats = (() => {
    if (!data) return { total: 0, withAlerts: 0, critical: 0, totalMatches: 0, totalGuests: 0 };
    const all = data.allProviderLocations;
    return {
      total: all.length,
      withAlerts: all.filter((p) => p.matchCount > 0).length,
      critical: all.filter((p) => p.criticalCount > 0).length,
      totalMatches: all.reduce((s, p) => s + p.matchCount, 0),
      totalGuests: all.reduce((s, p) => s + p.guestCount, 0),
    };
  })();

  const tabs = [
    { key: "hotspots" as const, label: "Crime Hotspots", icon: MapPin },
    { key: "charts" as const, label: "Analytics", icon: BarChart3 },
    { key: "frequent" as const, label: "Frequent Stays", icon: AlertTriangle },
    { key: "audit" as const, label: "Activity Log", icon: Activity },
  ];

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Intelligence Center</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Crime analytics, hotspot analysis, and pattern detection</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" /> Download Report
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Report Download Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              Download Monthly Report
            </DialogTitle>
            <DialogDescription>
              Generate a printable HTML intelligence report for the selected month.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="report-month">Month</Label>
              <Select value={reportMonth} onValueChange={setReportMonth}>
                <SelectTrigger id="report-month"><SelectValue placeholder="Select month" /></SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="report-year">Year</Label>
              <Select value={reportYear} onValueChange={setReportYear}>
                <SelectTrigger id="report-year"><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReportOpen(false)} disabled={reportGenerating}>
              Cancel
            </Button>
            <Button onClick={handleDownloadReport} disabled={reportGenerating}>
              {reportGenerating ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating...</>
              ) : (
                <><FileDown className="mr-1.5 h-3.5 w-3.5" /> Download</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <a ref={reportLinkRef} className="hidden" />

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-0.5">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !data ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No intelligence data available</p></CardContent></Card>
      ) : (
        <>
          {/* Crime Hotspots - Full Information Display */}
          {activeTab === "hotspots" && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: "Providers", value: hotspotStats.total, icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50" },
                  { label: "With Alerts", value: hotspotStats.withAlerts, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
                  { label: "Critical", value: hotspotStats.critical, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
                  { label: "Total Matches", value: hotspotStats.totalMatches, icon: MapPin, color: "text-orange-600", bg: "bg-orange-50" },
                  { label: "Total Guests", value: hotspotStats.totalGuests, icon: Users, color: "text-sky-600", bg: "bg-sky-50" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border bg-card p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md ${s.bg}`}>
                        <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    </div>
                    <p className="text-lg font-bold">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="flex gap-1 flex-wrap">
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM", "NONE"].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setHotspotFilter(sev)}
                      className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                        hotspotFilter === sev
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {sev === "NONE" ? "No Alerts" : sev === "ALL" ? "All" : sev}
                      {sev !== "ALL" && sev !== "NONE" && (
                        <span className="ml-1">
                          ({(data.allProviderLocations || []).filter((p) => getSeverity(p) === sev).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1 w-full sm:w-auto">
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by name, address, type, or phone..."
                      value={hotspotSearch}
                      onChange={(e) => setHotspotSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {filteredHotspots.length} guesthouse{filteredHotspots.length !== 1 ? "s" : ""} found
                </span>
              </div>

              {/* Guesthouse Cards */}
              {paginatedHotspots.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No guesthouses match the current filter</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting the severity filter or search query</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {paginatedHotspots.map((p) => {
                    const sev = getSeverity(p);
                    const sevCfg = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.NONE;
                    const isExpanded = expandedProvider === p.id;

                    return (
                      <Card
                        key={p.id}
                        className={`overflow-hidden transition-all hover:shadow-md ${
                          p.matchCount > 0 ? "border-l-4" : ""
                        }`}
                        style={{
                          borderLeftColor: sev === "CRITICAL" ? "#dc2626" : sev === "HIGH" ? "#ea580c" : sev === "MEDIUM" ? "#d97706" : p.matchCount > 0 ? "#6366f1" : undefined,
                        }}
                      >
                        {/* Card Header */}
                        <div className="p-3 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate">{p.name}</p>
                                  <p className="text-[10px] text-muted-foreground capitalize">{p.type || "Guesthouse"}</p>
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline" className={`text-[9px] shrink-0 ${sevCfg.bg} ${sevCfg.text} ${sevCfg.border}`}>
                              {sevCfg.label}
                            </Badge>
                          </div>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="px-3 pb-2">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{p.address || "No address set"}</span>
                          </div>
                        </div>

                        <div className="px-3 pb-2">
                          <div className="grid grid-cols-4 gap-1.5">
                            <div className="text-center rounded-md bg-muted/50 p-1.5">
                              <p className="text-sm font-bold">{p.guestCount}</p>
                              <p className="text-[8px] text-muted-foreground">Guests</p>
                            </div>
                            <div className="text-center rounded-md bg-muted/50 p-1.5">
                              <p className="text-sm font-bold">{p.roomCount}</p>
                              <p className="text-[8px] text-muted-foreground">Rooms</p>
                            </div>
                            <div className="text-center rounded-md bg-muted/50 p-1.5">
                              <p className={`text-sm font-bold ${p.matchCount > 0 ? "text-red-600" : ""}`}>{p.matchCount}</p>
                              <p className="text-[8px] text-muted-foreground">Matches</p>
                            </div>
                            <div className="text-center rounded-md bg-muted/50 p-1.5">
                              <p className={`text-sm font-bold ${p.criticalCount > 0 ? "text-red-700" : p.highCount > 0 ? "text-orange-600" : ""}`}>
                                {p.criticalCount + p.highCount}
                              </p>
                              <p className="text-[8px] text-muted-foreground">High/Crit</p>
                            </div>
                          </div>
                        </div>

                        {/* Expand/Collapse Button */}
                        <button
                          onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                          className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 border-t transition-colors"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="h-3 w-3" /> Less Details</>
                          ) : (
                            <><ChevronDown className="h-3 w-3" /> Full Details</>
                          )}
                        </button>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-2 border-t bg-muted/20 space-y-2">
                            {/* Contact & Location */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 text-xs">
                                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span>{p.phone || "No phone"}</span>
                              </div>
                              <div className="flex items-start gap-2 text-xs">
                                <Globe className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                <span>{p.address || "No address on file"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <Crosshair className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-mono text-[10px]">
                                  {p.hasCoordinates
                                    ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`
                                    : "Coordinates not set"}
                                </span>
                              </div>
                            </div>

                            {/* Match Breakdown */}
                            {p.matchCount > 0 && (
                              <div className="rounded-md border p-2 bg-red-50/50 border-red-100">
                                <p className="text-[10px] font-semibold text-red-700 mb-1.5">Alert Breakdown</p>
                                <div className="flex gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-red-500" />
                                    <span className="text-[10px]">Critical: <strong>{p.criticalCount}</strong></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                                    <span className="text-[10px]">High: <strong>{p.highCount}</strong></span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                                    <span className="text-[10px]">Total: <strong>{p.matchCount}</strong></span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Risk Score Bar */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-muted-foreground">Risk Score</span>
                                <span className="text-[10px] font-bold">
                                  {p.matchCount === 0 ? "0" : getRiskScore(p)}
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    sev === "CRITICAL" ? "bg-red-500" : sev === "HIGH" ? "bg-orange-500" : sev === "MEDIUM" ? "bg-amber-500" : "bg-indigo-400"
                                  }`}
                                  style={{
                                    width: p.matchCount === 0 ? "0%" : `${Math.min(100, (getRiskScore(p) / Math.max(1, hotspotStats.totalMatches > 0 ? hotspotStats.totalMatches : 1)) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {filteredHotspots.length > 0 && (
                <PaginationControls
                  currentPage={hotspotPag.currentPage}
                  totalPages={hotspotPag.totalPages}
                  pageSize={hotspotPag.pageSize}
                  pageSizeOptions={hotspotPag.pageSizeOptions}
                  totalItems={filteredHotspots.length}
                  rangeInfo={hotspotPag.rangeInfo}
                  goToPage={hotspotPag.goToPage}
                  setPageSize={hotspotPag.setPageSize}
                />
              )}
            </div>
          )}

          {/* Analytics Charts */}
          {activeTab === "charts" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4" /> Occupancy vs. Suspect Matches (6 Months)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.occupancyCrimeCorrelation.map((m) => (
                      <div key={m.month} className="flex items-center gap-3">
                        <span className="w-16 text-xs text-muted-foreground shrink-0">{m.month}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-1">
                            <span className="text-[10px] text-sky-600 w-5">R:{m.reservations}</span>
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${Math.min(100, (m.reservations / Math.max(...data.occupancyCrimeCorrelation.map(x => x.reservations), 1)) * 100)}%` }} />
                            </div>
                          </div>
                          <div className="flex-1 flex items-center gap-1">
                            <span className="text-[10px] text-red-600 w-5">A:{m.suspectMatches}</span>
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${Math.min(100, (m.suspectMatches / Math.max(...data.occupancyCrimeCorrelation.map(x => x.suspectMatches), 1)) * 100)}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Reservations</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Suspect Matches</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> Provider Hotspot Rankings</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {pagRankings.map((h, i) => (
                      <div key={h.providerId || i} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-muted-foreground">{(rankingPag.currentPage - 1) * rankingPag.pageSize + i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{h.providerName || "Unknown"}</p>
                          <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, (h.matchCount / Math.max(...data.hotspotData.map(x => x.matchCount), 1)) * 100)}%` }} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">{h.matchCount}</p>
                          <p className="text-[10px] text-muted-foreground">matches</p>
                        </div>
                        {(h.criticalCount > 0 || h.highCount > 0) && (
                          <div className="flex gap-0.5 shrink-0">
                            {h.criticalCount > 0 && <Badge className="bg-red-100 text-red-800 text-[8px] px-1 py-0">C:{h.criticalCount}</Badge>}
                            {h.highCount > 0 && <Badge className="bg-orange-100 text-orange-800 text-[8px] px-1 py-0">H:{h.highCount}</Badge>}
                          </div>
                        )}
                      </div>
                    ))}
                    {data.hotspotData.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hotspot data</p>}
                  </div>
                  {data.hotspotData.length > rankingPag.pageSize && (
                    <PaginationControls currentPage={rankingPag.currentPage} totalPages={rankingPag.totalPages} pageSize={rankingPag.pageSize} pageSizeOptions={rankingPag.pageSizeOptions} totalItems={data.hotspotData.length} rangeInfo={rankingPag.rangeInfo} goToPage={rankingPag.goToPage} setPageSize={rankingPag.setPageSize} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Frequent Stay Alerts */}
          {activeTab === "frequent" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /> Frequent Stay Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {data.frequentStays.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">No frequent stay patterns detected. Patterns appear when guests stay at multiple guesthouses with short intervals.</p>
                ) : (
                  <div className="divide-y">
                    {pagFreq.map((f) => (
                      <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{f.guestName}</p>
                            <Badge variant="outline" className={`text-[9px] ${RISK_STYLES[f.riskLevel] || ""}`}>{f.riskLevel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{f.guestPhone || f.guestIdNumber}</p>
                          <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span>{f.stayCount} stays</span>
                            <span>{f.avgDaysBetween} avg days between</span>
                            <span>Providers: {JSON.parse(f.providerNames || "[]").join(", ")}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(f.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {data.frequentStays.length > freqPag.pageSize && (
                  <PaginationControls currentPage={freqPag.currentPage} totalPages={freqPag.totalPages} pageSize={freqPag.pageSize} pageSizeOptions={freqPag.pageSizeOptions} totalItems={data.frequentStays.length} rangeInfo={freqPag.rangeInfo} goToPage={freqPag.goToPage} setPageSize={freqPag.setPageSize} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity Log */}
          {activeTab === "audit" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4" /> Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentActivity.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">No activity recorded yet</p>
                ) : (
                  <div className="divide-y">
                    {pagAudit.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[9px]">{a.action}</Badge>
                            <p className="text-xs">{a.officerName || "System"}</p>
                          </div>
                          {a.targetId && <p className="text-[10px] text-muted-foreground mt-0.5">{a.targetType}: {a.targetId.slice(0, 12)}...</p>}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {data.recentActivity.length > auditPag.pageSize && (
                  <PaginationControls currentPage={auditPag.currentPage} totalPages={auditPag.totalPages} pageSize={auditPag.pageSize} pageSizeOptions={auditPag.pageSizeOptions} totalItems={data.recentActivity.length} rangeInfo={auditPag.rangeInfo} goToPage={auditPag.goToPage} setPageSize={auditPag.setPageSize} />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
