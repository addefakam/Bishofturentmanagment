"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { apiGetAnomalies, apiReviewAnomalies, apiTriggerAnomalyScan } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, BrainCircuit, RefreshCw, Eye, EyeOff, CheckCircle2, XCircle, ShieldAlert,
  TrendingUp, Activity, Filter, Loader2, Zap, Info, ToggleLeft, ToggleRight,
} from "lucide-react";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { usePagination } from "@/hooks/use-pagination";

// ── Types ──
interface AnomalyItem {
  id: string;
  type: string;
  severity: string;
  riskScore: number;
  guestName: string;
  guestPhone: string;
  guestIdNumber: string;
  providerId: string;
  providerName: string;
  description: string;
  metadata: string;
  isReviewed: number; // SQLite boolean = 0/1
  createdAt: string;
}
interface AnomalyStats {
  total: number;
  unreviewed: number;
  bySeverity: { severity: string; count: number }[];
  byType: { type: string; count: number }[];
  last30Days: number;
}
const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const TYPE_LABELS: Record<string, string> = {
  IDENTITY_MISMATCH: "Identity Mismatch",
  RAPID_MULTI_PROVIDER: "Rapid Multi-Provider",
  NO_SHOW_PATTERN: "No-Show Pattern",
  CASH_ANOMALY: "Cash Anomaly",
  CROSS_PROVIDER_ID: "Cross-Provider ID",
  SHORT_STAY_PATTERN: "Short Stay Pattern",
  FAKE_ID_PATTERN: "Fake ID Pattern",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  IDENTITY_MISMATCH: "Same phone linked to different names or IDs across providers",
  RAPID_MULTI_PROVIDER: "Bookings at 2+ providers within 48 hours",
  NO_SHOW_PATTERN: "3+ cancelled or unfulfilled reservations",
  CASH_ANOMALY: "Unusually large cash payment detected",
  CROSS_PROVIDER_ID: "Same ID number with different names at multiple providers",
  SHORT_STAY_PATTERN: "Repeated 1-night stays at multiple providers",
  FAKE_ID_PATTERN: "Same ID number shared by multiple guests",
};

function getRiskColor(score: number): string {
  if (score >= 75) return "text-red-600";
  if (score >= 50) return "text-orange-600";
  if (score >= 25) return "text-yellow-600";
  return "text-emerald-600";
}

function getRiskBg(score: number): string {
  if (score >= 75) return "bg-red-50";
  if (score >= 50) return "bg-orange-50";
  if (score >= 25) return "bg-yellow-50";
  return "bg-emerald-50";
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h ago`;
  } catch {
    return dateStr;
  }
}

export default function AnomaliesPage() {
  const { refreshKey } = useAppStore();
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [detectionEnabled, setDetectionEnabled] = useState<boolean>(false);

  const pagination = usePagination({ totalItems: stats?.total || 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (selectedType) q.set("type", selectedType);
      if (selectedSeverity) q.set("severity", selectedSeverity);
      q.set("page", String(pagination.currentPage));
      q.set("pageSize", String(pagination.pageSize));

      const data = await apiGetAnomalies(q.toString());
      setAnomalies((data.anomalies || []) as AnomalyItem[]);
      setStats(data.stats || null);
      pagination.setTotalItems(data.total || 0);
      // Update enabled state from API response
      if (data.enabled !== undefined) {
        setDetectionEnabled(data.enabled);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load anomalies");
    } finally {
    setLoading(false);
  }
  }, [selectedType, selectedSeverity, pagination.currentPage, pagination.pageSize, refreshKey]);

  const handleScan = async () => {
    try {
      setScanning(true);
      const result = await apiTriggerAnomalyScan();
      setScanResult(result.message);
      toast.success(result.message);
      fetchData(); // Refresh after scan
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
    setScanning(false);
  }
  };

  const handleReview = async () => {
    if (selectedIds.size === 0) {
      toast.error("Select anomalies to review");
      return;
    }
    try {
      await apiReviewAnomalies([...selectedIds]);
      toast.success(`Reviewed ${selectedIds.size} anomalies`);
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      toast.error("Failed to review anomalies");
  }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const unreviewedCount = stats?.unreviewed || 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anomaly Detection</h1>
          <p className="text-sm text-gray-500">
            AI-powered pattern analysis — automatically detects suspicious behavior across all providers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {detectionEnabled ? (
            <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs font-medium px-2.5 py-1">
              <ToggleRight className="h-3 w-3 mr-1" />Active
            </Badge>
          ) : (
            <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs font-medium px-2.5 py-1">
              <ToggleLeft className="h-3 w-3 mr-1" />Inactive
            </Badge>
          )}
          {unreviewedCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs font-bold px-2.5 py-1">
              {unreviewedCount} unreviewed
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run System Scan
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-sky-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Anomalies</span>
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-rose-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Unreviewed</span>
                <span className="text-2xl font-bold text-rose-600">{stats.unreviewed}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Last 30 Days</span>
                <span className="text-2xl font-bold text-amber-600">{stats.last30Days}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Anomaly Types</span>
                <span className="text-2xl font-bold text-violet-600">{stats.byType.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-1 gap-2">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Severity</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          {reviewMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setReviewMode(false)}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleReview}>
                Mark Reviewed ({selectedIds.size})
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewMode(true)}
            >
              Select to Review
            </Button>
          )}
        </div>
      </div>

      {/* Detection Status Banner */}
      {!detectionEnabled && !loading && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <ToggleLeft className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Automatic detection is OFF.</strong> Reservation creation and check-in will not trigger anomaly analysis. Toggle it from the sidebar to enable.
          </p>
        </div>
      )}

      {/* Scan Result Banner */}
      {scanResult && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-sm text-emerald-800 font-medium">{scanResult}</p>
        </div>
      )}

      {/* Anomalies Table */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : anomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <BrainCircuit className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">No anomalies detected</p>
          <p className="text-xs text-gray-400 mt-1">
            Anomalies are automatically detected when reservations are created or guests check in.
            {" "}You can also run a manual system scan.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs text-gray-500">Type</TableHead>
                    <TableHead className="text-xs text-gray-500">Severity</TableHead>
                    <TableHead className="text-xs text-gray-500 text-right">Risk</TableHead>
                    <TableHead className="text-xs text-gray-500">Guest</TableHead>
                    <TableHead className="text-xs text-gray-500">Phone</TableHead>
                    <TableHead className="text-xs text-gray-500">Provider</TableHead>
                    <TableHead className="text-xs text-gray-500">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.map((a) => {
                    const meta = a.metadata ? JSON.parse(a.metadata) : {};
                    return (
                      <TableRow
                        key={a.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          reviewMode && selectedIds.has(a.id) ? "bg-violet-50" : ""
                        }`}
                      >
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            {reviewMode && (
                              <button
                                onClick={() => toggleSelect(a.id)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                {selectedIds.has(a.id) ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <Zap className="h-4 w-4 text-violet-500" />
                            )}
                            <span className="text-xs font-medium text-gray-700">
                              {TYPE_LABELS[a.type] || a.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className={SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.LOW}>
                            {a.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <span className={`font-bold text-sm ${getRiskColor(a.riskScore)}`}>{a.riskScore}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate max-w-[150px]" title={a.guestName}>{a.guestName}</p>
                          {a.guestIdNumber && (
                            <p className="text-[10px] text-gray-400 truncate max-w-[150px]" title={a.guestIdNumber}>
                              ID: {a.guestIdNumber}
                            </p>
                          )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs text-gray-600 font-mono">{a.guestPhone || "—"}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs text-gray-600 truncate max-w-[120px]" title={a.providerName}>{a.providerName || "—"}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(a.createdAt)}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {anomalies.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={pagination.setCurrentPage}
        />
      )}

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-sky-500" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            The Smart Anomaly Detection engine uses <strong>rule-based pattern analysis</strong> (no external AI API)
            to automatically detect suspicious behavior across all guesthouses in the system.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(TYPE_DESCRIPTIONS).map(([type, desc]) => (
              <div key={type} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-violet-500" />
                  <span className="font-medium text-gray-900">{TYPE_LABELS[type]}</span>
                </div>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800">Risk Scoring</span>
            </div>
            <p className="text-xs text-amber-700">
              Each anomaly gets a risk score (0–100) based on the type and pattern.
              Scores are weighted: ID fraud = 45, cross-provider ID = 40, rapid multi-provider = 35, etc.
              Higher scores trigger automatic police notifications.
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            <strong>Toggle:</strong> When ON, detection runs automatically on every reservation creation and guest check-in.
            When OFF, zero performance impact on those operations.
            <strong>Manual Scan</strong> always works regardless of the toggle.
          </p>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewMode} onOpenChange={(open) => { if (!open) setReviewMode(false); setSelectedIds(new Set()); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Anomalies</DialogTitle>
            <DialogDescription>
              {selectedIds.size} anomaly(ies) selected for review. This marks them as reviewed.
            Reviewed anomalies won't appear in the unreviewed count.
          </DialogDescription>
          </DialogHeader>
          <DialogFooter>
              <Button variant="outline" onClick={() => setReviewMode(false)}>Cancel</Button>
              <Button onClick={handleReview} disabled={selectedIds.size === 0}>
                Confirm ({selectedIds.size})
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
