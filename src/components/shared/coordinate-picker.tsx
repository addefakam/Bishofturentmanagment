"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CoordinatePickerProps {
  latitude: number;
  longitude: number;
  address: string;
  onChange: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: [number, number] = [9.02, 38.75];

export default function CoordinatePicker({ latitude, longitude, address, onChange }: CoordinatePickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const lat = latitude || DEFAULT_CENTER[0];
    const lng = longitude || DEFAULT_CENTER[1];
    const hasRealCoords = latitude !== 9.02 || longitude !== 38.75;

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([lat, lng], hasRealCoords ? 15 : 12);

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    // Marker
    const markerIcon = L.divIcon({
      className: "custom-pin",
      html: `<div style="width:24px;height:24px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([lat, lng], { icon: markerIcon, draggable: true }).addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
    });

    // Click map to move marker
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)));
    });

    mapInstanceRef.current = map;
  }, [latitude, longitude, onChange]);

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update marker position when props change externally (e.g. after geocode)
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      const lat = latitude || DEFAULT_CENTER[0];
      const lng = longitude || DEFAULT_CENTER[1];
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.panTo([lat, lng], { animate: true });
    }
  }, [latitude, longitude]);

  return (
    <div className="space-y-2">
      <div ref={mapRef} className="h-[250px] w-full rounded-lg border overflow-hidden" />
      <p className="text-[10px] text-muted-foreground">
        Click on the map or drag the pin to set the exact location. Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </p>
    </div>
  );
}
