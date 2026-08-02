"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ethiopianRegions,
  getZones,
  getWoredas,
  getLevel2Label,
} from "@/lib/ethiopian-admin-divisions";

export interface AddressData {
  region: string;
  zone: string;
  woreda: string;
  kebele: string;
  houseNumber: string;
  streetName: string;
}

interface AddressFieldsProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  /** If true, only show fields that are populated (for compact display) */
  compact?: boolean;
  /** Number of columns for the grid layout (default 2) */
  columns?: 2 | 3;
}

const emptyAddress: AddressData = {
  region: "",
  zone: "",
  woreda: "",
  kebele: "",
  houseNumber: "",
  streetName: "",
};

export function getEmptyAddress(): AddressData {
  return { ...emptyAddress };
}

export default function AddressFields({
  value,
  onChange,
  columns = 2,
}: AddressFieldsProps) {
  const zones = useMemo(
    () => (value.region ? getZones(value.region) : []),
    [value.region]
  );

  const woredas = useMemo(
    () => (value.region && value.zone ? getWoredas(value.region, value.zone) : []),
    [value.region, value.zone]
  );

  const level2Label = useMemo(
    () => (value.region ? getLevel2Label(value.region) : "Zone/Sub-city"),
    [value.region]
  );

  const update = (field: keyof AddressData, val: string) => {
    const next = { ...value, [field]: val };
    // Reset dependent fields when a parent changes
    if (field === "region") {
      next.zone = "";
      next.woreda = "";
    } else if (field === "zone") {
      next.woreda = "";
    }
    onChange(next);
  };

  const colClass = columns === 3
    ? "grid grid-cols-1 sm:grid-cols-3 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 gap-3";

  return (
    <div className="space-y-3">
      <div className={colClass}>
        {/* Region */}
        <div className="space-y-1.5">
          <Label>Region <span className="text-rose-500">*</span></Label>
          <Select
            value={value.region}
            onValueChange={(v) => update("region", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {ethiopianRegions.map((r) => (
                <SelectItem key={r.name} value={r.name}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Zone / Sub-city */}
        <div className="space-y-1.5">
          <Label>{level2Label} <span className="text-rose-500">*</span></Label>
          <Select
            value={value.zone}
            onValueChange={(v) => update("zone", v)}
            disabled={!value.region}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={value.region ? `Select ${level2Label.toLowerCase()}` : "Select region first"}
              />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>
                  {z}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Woreda */}
        <div className="space-y-1.5">
          <Label>Woreda <span className="text-rose-500">*</span></Label>
          <Select
            value={value.woreda}
            onValueChange={(v) => update("woreda", v)}
            disabled={!value.zone}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={value.zone ? "Select woreda" : `Select ${level2Label.toLowerCase()} first`}
              />
            </SelectTrigger>
            <SelectContent>
              {woredas.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kebele */}
        <div className="space-y-1.5">
          <Label>Kebele <span className="text-rose-500">*</span></Label>
          <Input
            placeholder="e.g. 01, 02, 03"
            value={value.kebele}
            onChange={(e) => update("kebele", e.target.value)}
          />
        </div>

        {/* House Number */}
        <div className="space-y-1.5">
          <Label>House No.</Label>
          <Input
            placeholder="e.g. H-124"
            value={value.houseNumber}
            onChange={(e) => update("houseNumber", e.target.value)}
          />
        </div>

        {/* Street Name */}
        <div className="space-y-1.5">
          <Label>Street Name</Label>
          <Input
            placeholder="e.g. Bole Road"
            value={value.streetName}
            onChange={(e) => update("streetName", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

/** Display formatted address (read-only) — used in police views, guest details, etc. */
export function AddressDisplay({
  region,
  zone,
  woreda,
  kebele,
  houseNumber,
  streetName,
}: Partial<AddressData>) {
  const parts: string[] = [];
  if (houseNumber) parts.push(houseNumber);
  if (streetName) parts.push(streetName);
  if (kebele) parts.push(`Kebele ${kebele}`);
  if (woreda) parts.push(woreda);
  if (zone) parts.push(zone);
  if (region) parts.push(region);

  const full = parts.join(", ");

  if (!full) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-0.5">
      {region && (
        <div className="flex gap-1.5 text-xs">
          <span className="text-muted-foreground shrink-0">Region:</span>
          <span className="font-medium">{region}</span>
        </div>
      )}
      {zone && (
        <div className="flex gap-1.5 text-xs">
          <span className="text-muted-foreground shrink-0">{getLevel2Label(region || "")}:</span>
          <span className="font-medium">{zone}</span>
        </div>
      )}
      {woreda && (
        <div className="flex gap-1.5 text-xs">
          <span className="text-muted-foreground shrink-0">Woreda:</span>
          <span className="font-medium">{woreda}</span>
        </div>
      )}
      {kebele && (
        <div className="flex gap-1.5 text-xs">
          <span className="text-muted-foreground shrink-0">Kebele:</span>
          <span className="font-medium">{kebele}</span>
        </div>
      )}
      {(houseNumber || streetName) && (
        <div className="flex gap-1.5 text-xs">
          <span className="text-muted-foreground shrink-0">Specific:</span>
          <span className="font-medium">{[houseNumber, streetName].filter(Boolean).join(", ")}</span>
        </div>
      )}
    </div>
  );
}
