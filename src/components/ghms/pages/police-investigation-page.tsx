"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { apiPoliceMovement, apiPoliceFrequentStays, apiPoliceTriggerFrequentAnalysis, apiPoliceGuestLinking } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import {
  Search, ArrowRight, AlertTriangle, RefreshCw, Users, GitBranch,
  Phone, CreditCard, MapPin, Calendar, Building2, ShieldAlert,
} from "lucide-react";

interface GuestResult {
  id: string; name: string; phone: string; email: string; idNumber: string;
  nationality: string; provider: { id: string; name: string; address: string } | null;
  reservations: { id: string; checkIn: string; checkOut: string; status: string; nights: number; totalCost: number; room: { number: string; name: string; type: string } }[];
}
interface MatchResult {
  id: string; guestName: string; guestPhone: string; matchType: string; providerName: string;
  createdAt: string; suspectedPerson: { name: string; severity: string; description: string };
}
interface LinkedGroup {
  linkType: string; linkValue: string;
  guests: { id: string; name: string; phone: string; idNumber: string; providerName: string; nationality: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  UPCOMING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-slate-100 text-slate-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function PoliceInvestigationPage() {
  const { refreshKey } = useAppStore();
  const [activeTab, setActiveTab] = useState<"movement" | "frequent" | "linking">("movement");

  // Movement
  const [search, setSearch] = useState("");
  const [guests, setGuests] = useState<GuestResult[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [moveLoading, setMoveLoading] = useState(false);

  // Frequent
  const [freqStays, setFreqStays] = useState<any[]>([]);
  const [freqLoading, setFreqLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const freqPag = usePagination({ totalItems: freqStays.length, initialPageSize: 10, pageSizeOptions: [5, 10, 20, 50] });
  const pagFreq = freqPag.paginate(freqStays);

  // Linking
  const [linkedGroups, setLinkedGroups] = useState<LinkedGroup[]>([]);
  const [linkLoading, setLinkLoading] = useState(true);
  const linkPag = usePagination({ totalItems: linkedGroups.length, initialPageSize: 10, pageSizeOptions: [5, 10, 20, 50] });
  const pagLinks = linkPag.paginate(linkedGroups);

  // Fetch frequent stays
  const fetchFreq = useCallback(async () => {
    try { setFreqLoading(true); const d = await apiPoliceFrequentStays(); setFreqStays(Array.isArray(d) ? d : []); }
    catch { toast.error("Failed to load frequent stays"); }
    finally { setFreqLoading(false); }
  }, []);

  // Fetch linked guests
  const fetchLinks = useCallback(async () => {
    try { setLinkLoading(true); const d: any = await apiPoliceGuestLinking(); setLinkedGroups(d.linkedGroups || []); }
    catch { toast.error("Failed to load guest links"); }
    finally { setLinkLoading(false); }
  }, []);

  useEffect(() => { fetchFreq(); fetchLinks(); }, [fetchFreq, fetchLinks, refreshKey]);

  // Search movement
  const searchMovement = async () => {
    if (!search.trim()) return;
    try {
      setMoveLoading(true);
      const q = search.includes("@") ? `email=${search}` : /^\d+$/.test(search.replace(/\s/g, "")) ? `phone=${search.replace(/\s/g, "")}` : `name=${search}`;
      const d: any = await apiPoliceMovement(q);
      setGuests(d.guests || []);
      setMatches(d.suspectMatches || []);
    } catch { toast.error("Search failed"); }
    finally { setMoveLoading(false); }
  };

  const triggerAnalysis = async () => {
    try {
      setAnalyzing(true);
      const d: any = await apiPoliceTriggerFrequentAnalysis();
      toast.success(d.message || "Analysis complete");
      fetchFreq();
    } catch { toast.error("Analysis failed"); }
    finally { setAnalyzing(false); }
  };

  const tabs = [
    { key: "movement" as const, label: "Guest Movement", icon: ArrowRight },
    { key: "frequent" as const, label: "Frequent Stays", icon: AlertTriangle },
    { key: "linking" as const, label: "Guest Linking", icon: GitBranch },
  ];

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Investigation Tools</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Track guest movement, detect patterns, find linked identities</p>
        </div>
      </div>

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

      {/* Guest Movement Tracker */}
      {activeTab === "movement" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Search Guest Across All Providers</CardTitle></CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Guest name, phone, or ID number..." value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchMovement()} className="pl-9" />
              </div>
              <Button onClick={searchMovement} disabled={moveLoading || !search.trim()}>
                <Search className="mr-1 h-3.5 w-3.5" /> {moveLoading ? "Searching..." : "Track"}
              </Button>
            </CardContent>
          </Card>

          {moveLoading && <Skeleton className="h-32 w-full rounded-xl" />}

          {guests.length > 0 && guests[0].reservations.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Reservation Timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="relative space-y-0">
                  {guests.flatMap((g) =>
                    g.reservations.map((r, i) => (
                      <div key={r.id} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                            <Building2 className="h-4 w-4 text-slate-600" />
                          </div>
                          {i < g.reservations.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                        </div>
                        <div className="flex-1 rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{g.provider?.name || "Unknown"}</p>
                              <Badge className={`text-[9px] ${STATUS_COLORS[r.status] || ""}`}>{r.status}</Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{r.room?.number || ""} {r.room?.type || ""}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {r.checkIn} → {r.checkOut}</span>
                            <span>{r.nights} nights</span>
                            <span className="font-medium text-emerald-600">ETB {r.totalCost.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {matches.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm text-red-700"><ShieldAlert className="h-4 w-4" /> Suspect Matches for this Guest</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-red-700">{m.suspectedPerson.name}</p>
                        <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{m.providerName}</span><span>{m.matchType}</span><span>{new Date(m.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-red-50 text-red-800 border-red-200">{m.suspectedPerson.severity}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Frequent Stay Alerts */}
      {activeTab === "frequent" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={triggerAnalysis} disabled={analyzing}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${analyzing ? "animate-spin" : ""}`} /> Run Analysis
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {freqLoading ? (
                <div className="space-y-3 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : pagFreq.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No frequent stay alerts. Click &quot;Run Analysis&quot; to scan for patterns.</p>
              ) : (
                <div className="divide-y">
                  {pagFreq.map((f) => (
                    <div key={f.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:px-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium truncate">{f.guestName}</p>
                          <Badge variant="outline" className={`text-[9px] ${f.riskLevel === "HIGH" ? "bg-red-100 text-red-800 border-red-200" : f.riskLevel === "LOW" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"}`}>{f.riskLevel}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">{f.guestPhone || f.guestIdNumber}</p>
                        <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{f.stayCount} stays</span>
                          <span>{f.avgDaysBetween} avg days between</span>
                          <span className="text-amber-600">Providers: {(JSON.parse(f.providerNames || "[]") as string[]).join(", ")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <PaginationControls currentPage={freqPag.currentPage} totalPages={freqPag.totalPages} pageSize={freqPag.pageSize} pageSizeOptions={freqPag.pageSizeOptions} totalItems={freqStays.length} rangeInfo={freqPag.rangeInfo} goToPage={freqPag.goToPage} setPageSize={freqPag.setPageSize} />
        </div>
      )}

      {/* Guest Linking */}
      {activeTab === "linking" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><GitBranch className="h-4 w-4" /> Linked Guests (Same Phone/ID)</CardTitle></CardHeader>
            <CardContent className="p-0">
              {linkLoading ? (
                <div className="space-y-3 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : pagLinks.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No linked guests found</p>
              ) : (
                <div className="divide-y">
                  {pagLinks.map((group, gi) => (
                    <div key={gi} className="p-3 sm:px-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-[9px]">{group.linkType}</Badge>
                        <span className="text-xs font-mono text-muted-foreground">{group.linkValue}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.guests.map((g) => (
                          <div key={g.id} className="rounded-lg border p-2.5">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">{g.name}</p>
                              <Badge variant="outline" className="text-[9px] shrink-0">{g.providerName}</Badge>
                            </div>
                            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                              {g.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{g.phone}</span>}
                              {g.nationality && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{g.nationality}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <PaginationControls currentPage={linkPag.currentPage} totalPages={linkPag.totalPages} pageSize={linkPag.pageSize} pageSizeOptions={linkPag.pageSizeOptions} totalItems={linkedGroups.length} rangeInfo={linkPag.rangeInfo} goToPage={linkPag.goToPage} setPageSize={linkPag.setPageSize} />
        </div>
      )}
    </div>
  );
}
