"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { apiPoliceAuditLogs, apiPoliceGeofences, apiPoliceCreateGeofence, apiPoliceDeleteGeofence, apiPoliceOfficers, apiPoliceCreateOfficer, apiPoliceUpdateOfficer, apiPoliceDeleteOfficer } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, MapPin, RefreshCw, Activity, UserCog, UserPlus,
} from "lucide-react";

interface AuditLog { id: string; officerName: string; action: string; targetId: string | null; targetType: string | null; ipAddress: string | null; createdAt: string; }
interface Geofence { id: string; name: string; address: string; latitude: number; longitude: number; radius: number; severity: string; isActive: boolean; createdAt: string; }
interface Officer { id: string; username: string; name: string; role: string; permissions: string; providerId: string | null; createdAt: string; }

const ACTION_LABELS: Record<string, string> = {
  VIEW_GUEST: "Viewed Guest", VIEW_MATCH: "Viewed Match", EXPORT_DATA: "Exported Data",
  LOGIN: "Officer Login", SCAN_WATCHLIST: "Scanned Watchlist",
};

export default function PoliceSecurityPage() {
  const { refreshKey } = useAppStore();
  const [activeTab, setActiveTab] = useState<"audit" | "geofence" | "officers">("audit");

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const auditPag = usePagination({ totalItems: auditTotal, initialPageSize: 20, pageSizeOptions: [10, 20, 50, 100] });
  const pagAudit = auditPag.paginate(auditLogs);

  const fetchAudit = useCallback(async () => {
    try {
      setAuditLoading(true);
      const params = new URLSearchParams({ page: String(auditPag.currentPage), pageSize: String(auditPag.pageSize) });
      if (actionFilter) params.set("action", actionFilter);
      const d: any = await apiPoliceAuditLogs(params.toString());
      setAuditLogs(d.logs || []);
      setAuditTotal(d.total || 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load audit logs";
      toast.error(msg);
    }
    finally { setAuditLoading(false); }
  }, [auditPag.currentPage, auditPag.pageSize, actionFilter]);

  // Geofences
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [geoLoading, setGeoLoading] = useState(true);
  const [showGeoForm, setShowGeoForm] = useState(false);
  const [geoForm, setGeoForm] = useState({ name: "", address: "", latitude: "", longitude: "", radius: "1000", severity: "HIGH" });
  const [geoSaving, setGeoSaving] = useState(false);

  // Officers
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [officersLoading, setOfficersLoading] = useState(true);
  const [showOfficerForm, setShowOfficerForm] = useState(false);
  const [officerForm, setOfficerForm] = useState({ username: "", password: "", name: "", policeRank: "OFFICER" });
  const [officerSaving, setOfficerSaving] = useState(false);

  useEffect(() => { fetchAudit(); }, [fetchAudit, refreshKey]);

  const fetchGeo = useCallback(async () => {
    try { setGeoLoading(true); const d = await apiPoliceGeofences(); setGeofences(Array.isArray(d) ? d : []); }
    catch { toast.error("Failed to load geofences"); }
    finally { setGeoLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "geofence") fetchGeo(); if (activeTab === "officers") fetchOfficers(); }, [activeTab, fetchGeo, refreshKey]);

  const createGeofence = async () => {
    if (!geoForm.name) { toast.error("Name is required"); return; }
    try {
      setGeoSaving(true);
      await apiPoliceCreateGeofence({ ...geoForm, latitude: parseFloat(geoForm.latitude), longitude: parseFloat(geoForm.longitude), radius: parseInt(geoForm.radius) });
      toast.success("Geofence created");
      setShowGeoForm(false);
      setGeoForm({ name: "", address: "", latitude: "", longitude: "", radius: "1000", severity: "HIGH" });
      fetchGeo();
    } catch { toast.error("Failed to create geofence"); }
    finally { setGeoSaving(false); }
  };

  const deleteGeofence = async (id: string) => {
    try { await apiPoliceDeleteGeofence(id); toast.success("Geofence deleted"); fetchGeo(); }
    catch { toast.error("Failed to delete"); }
  };

  const fetchOfficers = useCallback(async () => {
    try { setOfficersLoading(true); const d = await apiPoliceOfficers(); setOfficers(Array.isArray(d) ? d : []); }
    catch { toast.error("Failed to load officers"); }
    finally { setOfficersLoading(false); }
  }, []);

  const createOfficer = async () => {
    if (!officerForm.username || !officerForm.password || !officerForm.name) { toast.error("All fields are required"); return; }
    try {
      setOfficerSaving(true);
      await apiPoliceCreateOfficer(officerForm);
      toast.success("Officer created");
      setShowOfficerForm(false);
      setOfficerForm({ username: "", password: "", name: "", policeRank: "OFFICER" });
      fetchOfficers();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to create officer"); }
    finally { setOfficerSaving(false); }
  };

  const updateOfficerRank = async (id: string, rank: string) => {
    try {
      await apiPoliceUpdateOfficer(id, { policeRank: rank });
      toast.success("Rank updated");
      fetchOfficers();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to update rank"); }
  };

  const deleteOfficer = async (id: string) => {
    if (!confirm("Delete this officer?")) return;
    try { await apiPoliceDeleteOfficer(id); toast.success("Officer deleted"); fetchOfficers(); }
    catch { toast.error("Failed to delete officer"); }
  };

  const tabs = [
    { key: "audit" as const, label: "Audit Trail", icon: Activity },
    { key: "geofence" as const, label: "Geofencing", icon: MapPin },
    { key: "officers" as const, label: "Officers", icon: UserCog },
  ];

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Security & Configuration</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Audit trail, geofencing, and officer management</p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-0.5">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={"flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap " + (activeTab === tab.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Trail */}
      {activeTab === "audit" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v === "all" ? "" : v)}>
              <SelectTrigger size="sm" className="h-8 w-[150px] text-xs"><SelectValue placeholder="Filter action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="VIEW_GUEST">Viewed Guest</SelectItem>
                <SelectItem value="VIEW_MATCH">Viewed Match</SelectItem>
                <SelectItem value="EXPORT_DATA">Exported Data</SelectItem>
                <SelectItem value="SCAN_WATCHLIST">Scanned Watchlist</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              {auditLoading ? <div className="space-y-2 p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
                <div className="divide-y">
                  {pagAudit.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-3 sm:px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="text-[9px] shrink-0">{ACTION_LABELS[a.action] || a.action}</Badge>
                        <p className="text-xs truncate">{a.officerName || "System"}</p>
                        {a.targetId && <span className="text-[10px] text-muted-foreground hidden sm:inline">{a.targetType}: {a.targetId.slice(0, 8)}...</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {a.ipAddress && <span className="text-[10px] text-muted-foreground hidden sm:inline">{a.ipAddress}</span>}
                        <span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <PaginationControls currentPage={auditPag.currentPage} totalPages={auditPag.totalPages} pageSize={auditPag.pageSize} pageSizeOptions={auditPag.pageSizeOptions} totalItems={auditTotal} rangeInfo={auditPag.rangeInfo} goToPage={auditPag.goToPage} setPageSize={auditPag.setPageSize} />
        </div>
      )}

      {/* Geofencing */}
      {activeTab === "geofence" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowGeoForm(!showGeoForm)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {showGeoForm ? "Cancel" : "Add Zone"}
            </Button>
          </div>

          {showGeoForm && (
            <Card>
              <CardHeader><CardTitle className="text-sm">New Geofence Zone</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Zone Name *</Label><Input value={geoForm.name} onChange={(e) => setGeoForm({ ...geoForm, name: e.target.value })} placeholder="e.g. Bole District" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Address</Label><Input value={geoForm.address} onChange={(e) => setGeoForm({ ...geoForm, address: e.target.value })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Latitude *</Label><Input type="number" step="0.0001" value={geoForm.latitude} onChange={(e) => setGeoForm({ ...geoForm, latitude: e.target.value })} placeholder="9.0250" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Longitude *</Label><Input type="number" step="0.0001" value={geoForm.longitude} onChange={(e) => setGeoForm({ ...geoForm, longitude: e.target.value })} placeholder="38.7469" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Radius (meters)</Label><Input type="number" value={geoForm.radius} onChange={(e) => setGeoForm({ ...geoForm, radius: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Severity</Label>
                  <Select value={geoForm.severity} onValueChange={(v) => setGeoForm({ ...geoForm, severity: v })}>
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button size="sm" onClick={createGeofence} disabled={geoSaving}><RefreshCw className={"mr-1 h-3.5 w-3.5 " + (geoSaving ? "animate-spin" : "")} /> {geoSaving ? "Saving..." : "Create Zone"}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {geoLoading ? <Skeleton className="h-24 w-full" /> : geofences.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No geofence zones. Add zones to get alerts when suspects check in nearby.</p>
              ) : (
                <div className="divide-y">
                  {geofences.map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-3 sm:px-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            <span>{g.latitude.toFixed(4)}, {g.longitude.toFixed(4)}</span>
                            <span>Radius: {g.radius}m</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[9px] bg-red-100 text-red-800 border-red-200">{g.severity}</Badge>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => deleteGeofence(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Officers Management */}
      {activeTab === "officers" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Manage police officer accounts and rank assignments. ADMIN rank required for changes.</p>
            <Button size="sm" onClick={() => setShowOfficerForm(!showOfficerForm)}>
              <UserPlus className="mr-1 h-3.5 w-3.5" /> {showOfficerForm ? "Cancel" : "Add Officer"}
            </Button>
          </div>

          {showOfficerForm && (
            <Card>
              <CardHeader><CardTitle className="text-sm">New Police Officer</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label className="text-xs">Username *</Label><Input value={officerForm.username} onChange={(e) => setOfficerForm({ ...officerForm, username: e.target.value })} placeholder="officer.username" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Password *</Label><Input type="password" value={officerForm.password} onChange={(e) => setOfficerForm({ ...officerForm, password: e.target.value })} placeholder="Secure password" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={officerForm.name} onChange={(e) => setOfficerForm({ ...officerForm, name: e.target.value })} placeholder="Officer name" /></div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rank</Label>
                  <Select value={officerForm.policeRank} onValueChange={(v) => setOfficerForm({ ...officerForm, policeRank: v })}>
                    <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin — Full Access</SelectItem>
                      <SelectItem value="DETECTIVE">Detective — Investigate + Export</SelectItem>
                      <SelectItem value="OFFICER">Officer — Standard Access</SelectItem>
                      <SelectItem value="VIEWER">Viewer — Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button size="sm" onClick={createOfficer} disabled={officerSaving}><RefreshCw className={"mr-1 h-3.5 w-3.5 " + (officerSaving ? "animate-spin" : "")} /> {officerSaving ? "Creating..." : "Create Officer"}</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {officersLoading ? <Skeleton className="h-24 w-full" /> : officers.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No police officers found.</p>
              ) : (
                <div className="divide-y">
                  {officers.map((o) => {
                    let rank = "OFFICER";
                    try { const perms = JSON.parse(o.permissions || "[]"); const rankPerm = perms.find((p: string) => p.startsWith("police_rank:")); if (rankPerm) rank = rankPerm.replace("police_rank:", ""); } catch {}
                    const rankColors: Record<string, string> = { ADMIN: "bg-amber-100 text-amber-800 border-amber-200", DETECTIVE: "bg-violet-100 text-violet-800 border-violet-200", OFFICER: "bg-sky-100 text-sky-800 border-sky-200", VIEWER: "bg-slate-100 text-slate-600 border-slate-200" };
                    const rankLabels: Record<string, string> = { ADMIN: "Admin", DETECTIVE: "Detective", OFFICER: "Officer", VIEWER: "Viewer" };
                    return (
                      <div key={o.id} className="flex items-center justify-between p-3 sm:px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{o.name}</p>
                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                              <span>@{o.username}</span>
                              <span>Joined: {new Date(o.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Select defaultValue={rank} onValueChange={(v) => updateOfficerRank(o.id, v)}>
                            <SelectTrigger className="h-7 w-[110px] text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="DETECTIVE">Detective</SelectItem>
                              <SelectItem value="OFFICER">Officer</SelectItem>
                              <SelectItem value="VIEWER">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Badge variant="outline" className={`text-[9px] ${rankColors[rank] || ""}`}>{rankLabels[rank] || rank}</Badge>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => deleteOfficer(o.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Rank Permissions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { rank: "Admin", color: "bg-amber-100 text-amber-800", desc: "Full access to all police features + manage officers, security settings, and exports" },
                  { rank: "Detective", color: "bg-violet-100 text-violet-800", desc: "View guests, suspect alerts, watchlist, intelligence, investigations, and scanner" },
                  { rank: "Officer", color: "bg-sky-100 text-sky-800", desc: "View dashboard, providers, guests, suspect alerts, suspected persons, and scanner" },
                  { rank: "Viewer", color: "bg-slate-100 text-slate-800", desc: "Read-only access to dashboard, providers, and guest search" },
                ].map((r) => (
                  <div key={r.rank} className="flex items-start gap-2 rounded-lg border p-2.5">
                    <Badge variant="outline" className={`text-[9px] mt-0.5 shrink-0 ${r.color}`}>{r.rank}</Badge>
                    <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
