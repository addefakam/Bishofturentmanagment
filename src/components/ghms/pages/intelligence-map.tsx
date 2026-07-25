"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { headers } from "@/lib/api";
import {
  MapPin, Building2, AlertTriangle, Filter, X, Users, BedDouble,
  ChevronDown, ChevronUp, Crosshair,
} from "lucide-react";

export interface ProviderLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  phone: string;
  guestCount: number;
  roomCount: number;
  matchCount: number;
  criticalCount: number;
  highCount: number;
  hasCoordinates: boolean;
}

// Addis Ababa center
const DEFAULT_CENTER: [number, number] = [9.02, 38.75];
const DEFAULT_ZOOM = 12;

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#ea580c",
  MEDIUM: "#d97706",
  NONE: "#6366f1",
};

function getSeverity(h: { criticalCount: number; highCount: number; matchCount: number }) {
  if (h.criticalCount > 0) return "CRITICAL";
  if (h.highCount > 0) return "HIGH";
  if (h.matchCount > 0) return "MEDIUM";
  return "NONE";
}

function getRiskScore(h: { matchCount: number; criticalCount: number; highCount: number }) {
  return h.matchCount * 1 + h.criticalCount * 5 + h.highCount * 3;
}

interface IntelligenceMapProps {
  allProviders: ProviderLocation[];
}

export default function IntelligenceMap({ allProviders }: IntelligenceMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedProvider, setSelectedProvider] = useState<ProviderLocation | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [showGeofences, setShowGeofences] = useState(false);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);

  const filteredProviders = useMemo(() => {
    let list = allProviders;
    if (severityFilter !== "ALL") {
      list = list.filter((p) => getSeverity(p) === severityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
    }
    return list.sort((a, b) => getRiskScore(b) - getRiskScore(a));
  }, [allProviders, severityFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = allProviders.length;
    const withAlerts = allProviders.filter((p) => p.matchCount > 0).length;
    const critical = allProviders.filter((p) => p.criticalCount > 0).length;
    const totalMatches = allProviders.reduce((s, p) => s + p.matchCount, 0);
    const totalGuests = allProviders.reduce((s, p) => s + p.guestCount, 0);
    return { total, withAlerts, critical, totalMatches, totalGuests };
  }, [allProviders]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    mapInstanceRef.current = map;

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    heatLayerRef.current = L.layerGroup().addTo(map);
    geofenceLayerRef.current = L.layerGroup().addTo(map);
    map.addLayer(geofenceLayerRef.current);
    geofenceLayerRef.current.remove(); // hidden by default

    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      heatLayerRef.current = null;
      geofenceLayerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Update markers when data or filters change
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current || !heatLayerRef.current) return;

    const markersLayer = markersLayerRef.current;
    const heatLayer = heatLayerRef.current;
    markersLayer.clearLayers();
    heatLayer.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    filteredProviders.forEach((p) => {
      const lat = p.latitude || DEFAULT_CENTER[0];
      const lng = p.longitude || DEFAULT_CENTER[1];
      const sev = getSeverity(p);
      const color = SEVERITY_COLORS[sev] || SEVERITY_COLORS.NONE;
      const isSelected = selectedProvider?.id === p.id;

      // Heat circle for providers with matches
      if (p.matchCount > 0) {
        const radius = Math.max(300, Math.min(3000, p.matchCount * 500));
        L.circle([lat, lng], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: "6 4",
        }).addTo(heatLayer);
      }

      // Main marker
      const markerSize = p.matchCount > 0
        ? Math.max(10, Math.min(28, 10 + p.matchCount * 2))
        : 8;
      const opacity = severityFilter === "ALL" || getSeverity(p) === severityFilter ? 1 : 0.3;

      L.circleMarker([lat, lng], {
        radius: isSelected ? markerSize + 4 : markerSize,
        color: isSelected ? "#fff" : color,
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: opacity * 0.85,
      })
        .addTo(markersLayer)
        .on("click", () => {
          setSelectedProvider(p);
          mapInstanceRef.current?.panTo([lat, lng]);
        });

      bounds.push([lat, lng]);
    });

    // Fit bounds if we have markers and no explicit selection
    if (bounds.length > 0 && !selectedProvider) {
      const padding = bounds.length === 1 ? 0.02 : undefined;
      if (padding) {
        mapInstanceRef.current?.setView(bounds[0], 14);
      } else {
        mapInstanceRef.current?.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  // Fetch and render geofences
  useEffect(() => {
    if (!mapReady || !geofenceLayerRef.current) return;
    const layer = geofenceLayerRef.current;
    layer.clearLayers();
    if (!showGeofences) return;
    fetch("/api/police-geofences", { headers: headers() })
      .then((r) => r.json())
      .then((geofences: Array<{ id: string; name: string; latitude: number; longitude: number; radius: number; severity: string; isActive: boolean }>) => {
        const geofColors: Record<string, string> = { CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#eab308", LOW: "#22c55e" };
        for (const gf of geofences) {
          const color = geofColors[gf.severity] || "#ea580c";
          L.circle([gf.latitude, gf.longitude], {
            radius: gf.radius,
            color,
            fillColor: color,
            fillOpacity: 0.08,
            weight: 2,
            dashArray: "8 6",
          })
            .bindPopup(`<b>${gf.name}</b><br>Severity: ${gf.severity}<br>Radius: ${gf.radius}m`)
            .addTo(layer);
        }
      })
      .catch(() => {});
  }, [mapReady, showGeofences]);

  // Toggle geofence layer
  useEffect(() => {
    if (!mapInstanceRef.current || !geofenceLayerRef.current) return;
    if (showGeofences) {
      mapInstanceRef.current.addLayer(geofenceLayerRef.current);
    } else {
      mapInstanceRef.current.removeLayer(geofenceLayerRef.current);
    }
  }, [showGeofences]);

  }, [mapReady, filteredProviders, selectedProvider, severityFilter]);

  const flyTo = (p: ProviderLocation) => {
    setSelectedProvider(p);
    mapInstanceRef.current?.flyTo([p.latitude || DEFAULT_CENTER[0], p.longitude || DEFAULT_CENTER[1]], 15, { duration: 0.8 });
  };

  const resetView = () => {
    setSelectedProvider(null);
    mapInstanceRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.8 });
  };

  return (
    <div className="space-y-3">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Providers", value: stats.total, icon: Building2, color: "text-indigo-600" },
          { label: "With Alerts", value: stats.withAlerts, icon: AlertTriangle, color: "text-amber-600" },
          { label: "Critical", value: stats.critical, icon: AlertTriangle, color: "text-red-600" },
          { label: "Total Matches", value: stats.totalMatches, icon: MapPin, color: "text-orange-600" },
          { label: "Total Guests", value: stats.totalGuests, icon: Users, color: "text-sky-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-lg font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Map + Sidebar layout */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "NONE"].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                  severityFilter === sev
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {sev === "NONE" ? "No Alerts" : sev === "ALL" ? "All" : sev}
                {sev !== "ALL" && sev !== "NONE" && (
                  <span className="ml-1">
                    ({allProviders.filter((p) => getSeverity(p) === sev).length})
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <MapPin className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={resetView}>
            <Crosshair className="mr-1 h-3 w-3" /> Reset
          </Button>
          <Button
            variant={showGeofences ? "default" : "outline"}
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => setShowGeofences(!showGeofences)}
          >
            <MapPin className="mr-1 h-3 w-3" /> Geofences
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] lg:hidden"
            onClick={() => setShowPanel(!showPanel)}
          >
            {showPanel ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            List
          </Button>
        </div>

        {/* Map */}
        <div className="flex-1 rounded-xl border overflow-hidden shadow-sm relative">
          <div ref={mapRef} className="h-[450px] sm:h-[550px] w-full" />

          {/* Floating legend */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-sm rounded-lg border p-2 space-y-1">
            <p className="text-[9px] font-semibold text-muted-foreground px-1">LEGEND</p>
            {[
              { label: "Critical", color: "#dc2626" },
              { label: "High", color: "#ea580c" },
              { label: "Medium", color: "#d97706" },
              { label: "No Alerts", color: "#6366f1" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 px-1">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-[9px] text-muted-foreground">{l.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 px-1 pt-0.5 border-t mt-1">
              <span className="h-2.5 w-2.5 rounded-full border-2 border-dashed shrink-0" style={{ borderColor: "#ea580c" }} />
              <span className="text-[9px] text-muted-foreground">Heat zone</span>
            </div>
          </div>

          {/* Selected provider card on map */}
          {selectedProvider && (
            <div className="absolute top-3 right-3 z-[1000] w-56 bg-background/95 backdrop-blur-sm rounded-lg border shadow-lg">
              <div className="flex items-center justify-between p-2 border-b">
                <span className="text-[10px] font-semibold truncate">{selectedProvider.name}</span>
                <button onClick={() => setSelectedProvider(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="p-2 space-y-1.5 text-[10px]">
                <p className="text-muted-foreground">{selectedProvider.address || "No address"}</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className={`text-[8px] ${getSeverity(selectedProvider) === "CRITICAL" ? "bg-red-100 text-red-800 border-red-200" : getSeverity(selectedProvider) === "HIGH" ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-amber-100 text-amber-800 border-amber-200"}`}>
                    {getSeverity(selectedProvider)}
                  </Badge>
                  <span className="text-muted-foreground">{selectedProvider.type}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-1 border-t">
                  <div className="text-center">
                    <p className="font-bold text-sm">{selectedProvider.matchCount}</p>
                    <p className="text-muted-foreground">Matches</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">{selectedProvider.guestCount}</p>
                    <p className="text-muted-foreground">Guests</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">{selectedProvider.roomCount}</p>
                    <p className="text-muted-foreground">Rooms</p>
                  </div>
                </div>
                {(selectedProvider.criticalCount > 0 || selectedProvider.highCount > 0) && (
                  <div className="flex gap-2 pt-1">
                    {selectedProvider.criticalCount > 0 && <span className="text-red-600 font-medium">C:{selectedProvider.criticalCount}</span>}
                    {selectedProvider.highCount > 0 && <span className="text-orange-600 font-medium">H:{selectedProvider.highCount}</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Provider Sidebar List */}
        <div className={`lg:w-72 xl:w-80 ${showPanel ? "block" : "hidden lg:block"}`}>
          <div className="rounded-xl border overflow-hidden">
            <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
              <span className="text-[10px] font-semibold">
                Providers ({filteredProviders.length})
              </span>
              <span className="text-[9px] text-muted-foreground">Click to locate</span>
            </div>
            <ScrollArea className="h-[400px] sm:h-[500px]">
              <div className="divide-y">
                {filteredProviders.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">No providers match filter</p>
                ) : (
                  filteredProviders.map((p) => {
                    const sev = getSeverity(p);
                    const color = SEVERITY_COLORS[sev] || SEVERITY_COLORS.NONE;
                    const isSelected = selectedProvider?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => flyTo(p)}
                        className={`w-full text-left p-2.5 hover:bg-muted/50 transition-colors ${isSelected ? "bg-muted/70" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <p className="text-xs font-medium truncate">{p.name}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.address || "No address set"}</p>
                          </div>
                          {p.matchCount > 0 && (
                            <Badge variant="outline" className={`text-[8px] shrink-0 ${
                              sev === "CRITICAL" ? "bg-red-100 text-red-800 border-red-200"
                              : sev === "HIGH" ? "bg-orange-100 text-orange-800 border-orange-200"
                              : "bg-amber-100 text-amber-800 border-amber-200"
                            }`}>
                              {p.matchCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1.5 text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Users className="h-2.5 w-2.5" /> {p.guestCount} guests</span>
                          <span className="flex items-center gap-0.5"><BedDouble className="h-2.5 w-2.5" /> {p.roomCount} rooms</span>
                          {p.matchCount > 0 && (
                            <span className="flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5 text-amber-500" /> {p.matchCount} matches</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
