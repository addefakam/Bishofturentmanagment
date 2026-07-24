"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface HotspotItem {
  providerName: string;
  providerId: string;
  matchCount: number;
  criticalCount: number;
  highCount: number;
}

// Addis Ababa approximate center
const DEFAULT_CENTER: [number, number] = [9.02, 38.75];
const DEFAULT_ZOOM = 12;

export default function IntelligenceMap({ hotspotData }: { hotspotData: HotspotItem[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Add markers for hotspot providers - use random positions near Addis Ababa
    const colors: Record<string, string> = {
      CRITICAL: "#dc2626",
      HIGH: "#ea580c",
      MEDIUM: "#d97706",
      LOW: "#059669",
    };

    hotspotData.forEach((h, i) => {
      // Generate varied positions around Addis
      const lat = DEFAULT_CENTER[0] + (Math.sin(i * 2.1 + 0.5) * 0.06);
      const lng = DEFAULT_CENTER[1] + (Math.cos(i * 1.7 + 0.3) * 0.08);
      const severity = h.criticalCount > 0 ? "CRITICAL" : h.highCount > 0 ? "HIGH" : "MEDIUM";
      const color = colors[severity] || colors.MEDIUM;
      const radius = Math.max(200, Math.min(2000, h.matchCount * 300));

      L.circle([lat, lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);

      L.circleMarker([lat, lng], {
        radius: Math.max(6, Math.min(20, h.matchCount)),
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9,
      }).addTo(map).bindPopup(`
        <div style="font-family: system-ui; min-width: 150px">
          <strong>${h.providerName || "Unknown"}</strong><br/>
          <span style="color: ${color}">Severity: ${severity}</span><br/>
          Total Matches: <b>${h.matchCount}</b><br/>
          ${h.criticalCount > 0 ? `Critical: <b style="color: #dc2626">${h.criticalCount}</b><br/>` : ""}
          ${h.highCount > 0 ? `High: <b style="color: #ea580c">${h.highCount}</b>` : ""}
        </div>
      `);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [hotspotData]);

  return (
    <div className="rounded-xl border overflow-hidden shadow-sm">
      <div ref={mapRef} className="h-[400px] sm:h-[500px] w-full" />
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 text-[10px] text-muted-foreground">
        <span>Heat circles indicate suspect match concentration. Larger = more matches.</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" /> Critical</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-600" /> High</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-600" /> Medium</span>
        </div>
      </div>
    </div>
  );
}
