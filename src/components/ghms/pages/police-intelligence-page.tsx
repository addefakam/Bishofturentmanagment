"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { apiPoliceIntelligence } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MapPin, AlertTriangle, BarChart3, Activity, TrendingUp, RefreshCw,
} from "lucide-react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./intelligence-map"), { ssr: false, loading: () => <Skeleton className="h-[400px] w-full rounded-xl" /> });

interface HotspotItem { providerName: string; providerId: string; matchCount: number; criticalCount: number; highCount: number; }
interface MonthlyItem { month: string; reservations: number; suspectMatches: number; }
interface FreqStayItem { id: string; guestName: string; guestPhone: string; guestIdNumber: string; providerNames: string; stayCount: number; avgDaysBetween: number; riskLevel: string; isReviewed: boolean; createdAt: string; }
interface AuditItem { id: string; officerName: string; action: string; targetId: string | null; targetType: string | null; ipAddress: string | null; createdAt: string; }

const RISK_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function PoliceIntelligencePage() {
  const { refreshKey } = useAppStore();
  const [data, setData] = useState<{ frequentStays: FreqStayItem[]; hotspotData: HotspotItem[]; occupancyCrimeCorrelation: MonthlyItem[]; recentActivity: AuditItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"map" | "charts" | "frequent" | "audit">("map");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiPoliceIntelligence();
      setData(res);
    } catch { toast.error("Failed to load intelligence data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const tabs = [
    { key: "map" as const, label: "Crime Hotspot Map", icon: MapPin },
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
          <p className="text-xs sm:text-sm text-muted-foreground">Crime analytics, hotspot mapping, and pattern detection</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-0.5">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
          {/* Crime Hotspot Map */}
          {activeTab === "map" && <MapView hotspotData={data.hotspotData} />}

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
                    {data.hotspotData.slice(0, 10).map((h, i) => (
                      <div key={h.providerId || i} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
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
                    {data.frequentStays.map((f) => (
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
                    {data.recentActivity.map((a) => (
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
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
