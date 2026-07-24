"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { apiPoliceAuditLogs, apiPoliceGeofences, apiPoliceCreateGeofence, apiPoliceDeleteGeofence, apiPoliceAlertConfig, apiPoliceUpdateAlertConfig, apiPoliceExport } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Shield, Download, Mail, Smartphone, RefreshCw, MapPin,
  Clock, Eye, Activity, AlertTriangle,
} from "lucide-react";

interface AuditLog { id: string; officerName: string; action: string; targetId: string | null; targetType: string | null; ipAddress: string | null; createdAt: string; }
interface Geofence { id: string; name: string; address: string; latitude: number; longitude: number; radius: number; severity: string; isActive: boolean; createdAt: string; }
interface AlertConfig { id: string; emailEnabled: boolean; emailRecipients: string; smsEnabled: boolean; smsRecipients: string; escalationDelayMins: number; criticalImmediate: boolean; }

const ACTION_LABELS: Record<string, string> = {
  VIEW_GUEST: "Viewed Guest", VIEW_MATCH: "Viewed Match", EXPORT_DATA: "Exported Data",
  LOGIN: "Officer Login", SCAN_WATCHLIST: "Scanned Watchlist",
};

export default function PoliceSecurityPage() {
  const { refreshKey } = useAppStore();
  const [activeTab, setActiveTab] = useState<"audit" | "geofence" | "alerts" | "export">("audit");

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

  // Alert Config
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => { fetchAudit(); }, [fetchAudit, refreshKey]);

  const fetchGeo = useCallback(async () => {
    try { setGeoLoading(true); const d = await apiPoliceGeofences(); setGeofences(Array.isArray(d) ? d : []); }
    catch { toast.error("Failed to load geofences"); }
    finally { setGeoLoading(false); }
  }, []);

  const fetchConfig = useCallback(async () => {
    try { setConfigLoading(true); const d: any = await apiPoliceAlertConfig(); setConfig(d); }
    catch { toast.error("Failed to load config"); }
    finally { setConfigLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "geofence") fetchGeo(); if (activeTab === "alerts") fetchConfig(); }, [activeTab, fetchGeo, fetchConfig, refreshKey]);

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

  const saveConfig = async () => {
    if (!config) return;
    try {
      setConfigSaving(true);
      await apiPoliceUpdateAlertConfig(config);
      toast.success("Alert config saved");
    } catch { toast.error("Failed to save config"); }
    finally { setConfigSaving(false); }
  };

  const handleExport = async (type: string, format: string) => {
    try {
      const blob = await apiPoliceExport(`type=${type}&format=${format}`);
      const url = window.URL.createObjectURL(blob as any);
      const a = document.createElement("a");
      a.href = url;
      a.download = `police-${type}-${Date.now()}.${format}`;
      a.click();
      toast.success("Export downloaded");
    } catch { toast.error("Export failed"); }
  };

  const tabs = [
    { key: "audit" as const, label: "Audit Trail", icon: Activity },
    { key: "geofence" as const, label: "Geofencing", icon: MapPin },
    { key: "alerts" as const, label: "Alert Settings", icon: Shield },
    { key: "export" as const, label: "Legal Export", icon: Download },
  ];

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Security & Configuration</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Audit trail, geofencing, alert settings, and legal data export</p>
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

      {/* Alert Configuration */}
      {activeTab === "alerts" && config && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4" /> Alert Notification Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {configLoading ? <Skeleton className="h-48 w-full" /> : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">Email Alerts</p><p className="text-[10px] text-muted-foreground">Send alerts to email addresses</p></div></div>
                    <button onClick={() => setConfig({ ...config, emailEnabled: !config.emailEnabled })} className={"h-5 w-9 rounded-full transition-colors " + (config.emailEnabled ? "bg-emerald-600" : "bg-slate-200")}>
                      <div className={"h-4 w-4 rounded-full bg-white shadow transition-transform " + (config.emailEnabled ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                  {config.emailEnabled && (
                    <div className="ml-8"><Label className="text-xs">Email Recipients (comma-separated)</Label><Input value={config.emailRecipients.replace(/[\[\]"]/g, "")} onChange={(e) => setConfig({ ...config, emailRecipients: JSON.stringify(e.target.value.split(",").map((s) => s.trim())) })} placeholder="officer1@police.gov.et, officer2@police.gov.et" className="text-xs" /></div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-muted-foreground" /><div><p className="text-sm font-medium">SMS Alerts</p><p className="text-[10px] text-muted-foreground">Send alerts via SMS</p></div></div>
                    <button onClick={() => setConfig({ ...config, smsEnabled: !config.smsEnabled })} className={"h-5 w-9 rounded-full transition-colors " + (config.smsEnabled ? "bg-emerald-600" : "bg-slate-200")}>
                      <div className={"h-4 w-4 rounded-full bg-white shadow transition-transform " + (config.smsEnabled ? "translate-x-4" : "translate-x-0.5")} />
                    </button>
                  </div>
                  {config.smsEnabled && (
                    <div className="ml-8"><Label className="text-xs">SMS Recipients (comma-separated)</Label><Input value={config.smsRecipients.replace(/[\[\]"]/g, "")} onChange={(e) => setConfig({ ...config, smsRecipients: JSON.stringify(e.target.value.split(",").map((s) => s.trim())) })} placeholder="+251911234567, +251922345678" className="text-xs" /></div>
                  )}
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Escalation Delay (minutes)</Label>
                    <Input type="number" value={config.escalationDelayMins} onChange={(e) => setConfig({ ...config, escalationDelayMins: parseInt(e.target.value) || 60 })} className="text-xs" />
                    <p className="text-[10px] text-muted-foreground">How long before escalating HIGH alerts</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div><p className="text-sm font-medium">CRITICAL = Immediate</p><p className="text-[10px] text-muted-foreground">CRITICAL severity alerts are sent immediately</p></div>
                      <button onClick={() => setConfig({ ...config, criticalImmediate: !config.criticalImmediate })} className={"h-5 w-9 rounded-full transition-colors " + (config.criticalImmediate ? "bg-red-600" : "bg-slate-200")}>
                        <div className={"h-4 w-4 rounded-full bg-white shadow transition-transform " + (config.criticalImmediate ? "translate-x-4" : "translate-x-0.5")} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" onClick={saveConfig} disabled={configSaving}>
                    <RefreshCw className={"mr-1 h-3.5 w-3.5 " + (configSaving ? "animate-spin" : "")} /> {configSaving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legal Export */}
      {activeTab === "export" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Download className="h-4 w-4" /> Legal Data Export</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Export data in court-admissible format. All exports include metadata (timestamp, officer, source) for legal documentation.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { type: "guests", label: "Guest Registry", desc: "All guest records across providers", color: "bg-sky-50 border-sky-200 text-sky-800" },
                  { type: "matches", label: "Suspect Matches", desc: "All suspect match alerts", color: "bg-red-50 border-red-200 text-red-800" },
                  { type: "audit", label: "Audit Trail", desc: "Officer activity log", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
                ].map((exp) => (
                  <div key={exp.type} className={`rounded-lg border p-3 ${exp.color}`}>
                    <p className="text-sm font-medium">{exp.label}</p>
                    <p className="text-[10px] opacity-75 mb-3">{exp.desc}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleExport(exp.type, "json")}>JSON</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleExport(exp.type, "csv")}>CSV</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Export Everything</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Button size="sm" onClick={() => handleExport("all", "json")}><Download className="mr-1 h-3.5 w-3.5" /> Full Export (JSON)</Button>
              <Button size="sm" variant="outline" onClick={() => handleExport("all", "csv")}><Download className="mr-1 h-3.5 w-3.5" /> Full Export (CSV)</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
