"use client";

import { useState, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { apiPoliceMovement } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScanLine, Search, ShieldAlert, User, Phone, MapPin, Calendar,
  Building2, CreditCard,
} from "lucide-react";

interface GuestResult {
  id: string; name: string; phone: string; idNumber: string;
  nationality: string; provider: { id: string; name: string } | null;
  reservations: { id: string; checkIn: string; checkOut: string; status: string; room: { number: string } }[];
}
interface MatchResult {
  id: string; guestName: string; providerName: string; matchType: string;
  createdAt: string; suspectedPerson: { name: string; severity: string };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  UPCOMING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-slate-100 text-slate-800",
};

export default function PoliceScannerPage() {
  const [mode, setMode] = useState<"scan" | "manual">("manual");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [guests, setGuests] = useState<GuestResult[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const search = async (value: string) => {
    if (!value.trim()) return;
    try {
      setLoading(true);
      setHasSearched(true);
      const isPhone = /^\d+$/.test(value.replace(/\s/g, ""));
      const q = isPhone ? `phone=${value.replace(/\s/g, "")}` : `name=${value}`;
      const d: any = await apiPoliceMovement(q);
      setGuests(d.guests || []);
      setMatches(d.suspectMatches || []);
    } catch { toast.error("Search failed"); }
    finally { setLoading(false); }
  };

  // Simulate QR scan by filling input
  const simulateScan = () => {
    const demoIds = ["John Doe", "0911234567", "AA1234567"];
    const random = demoIds[Math.floor(Math.random() * demoIds.length)];
    setQuery(random);
    search(random);
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Watchlist Scanner</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Scan guest ID or phone against suspected persons watchlist</p>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-0.5">
          <button onClick={() => setMode("manual")} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "manual" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <Search className="h-3.5 w-3.5 mr-1 inline" /> Manual
          </button>
          <button onClick={() => setMode("scan")} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "scan" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <ScanLine className="h-3.5 w-3.5 mr-1 inline" /> Scan
          </button>
        </div>
      </div>

      {/* Scanner Interface */}
      <Card>
        <CardContent className="py-6">
          {mode === "scan" ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative h-48 w-48 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <ScanLine className="mx-auto h-10 w-10 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-500">Camera Scanner</p>
                  <p className="text-[10px] text-slate-400 mt-1">Point at guest ID card</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Camera access requires HTTPS. Use manual entry as fallback.</p>
              <Button variant="outline" size="sm" onClick={simulateScan}>
                <ScanLine className="mr-1 h-3.5 w-3.5" /> Demo Scan
              </Button>
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-3">
              <Input
                placeholder="Enter guest name, phone number, or ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search(query)}
                className="text-center text-lg h-12"
                autoFocus
              />
              <Button className="w-full" onClick={() => search(query)} disabled={loading || !query.trim()}>
                <Search className="mr-1 h-3.5 w-3.5" /> {loading ? "Scanning Watchlist..." : "Check Watchlist"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {loading && <Skeleton className="h-32 w-full rounded-xl" />}

      {hasSearched && !loading && (
        <>
          {/* Alert if suspect found */}
          {matches.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-red-700">
                  <ShieldAlert className="h-5 w-5" /> WATCHLIST MATCH FOUND — {matches.length} alert{matches.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {matches.map((m) => (
                    <div key={m.id} className="rounded-lg border-2 border-red-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-red-800">{m.suspectedPerson.name}</p>
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-[9px]">{m.suspectedPerson.severity}</Badge>
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Provider: {m.providerName}</span>
                        <span>Type: {m.matchType}</span>
                        <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Guest Info */}
          {guests.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><User className="h-4 w-4" /> Guest Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {guests.map((g) => (
                  <div key={g.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                        <User className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{g.name}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {g.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{g.phone}</span>}
                          {g.nationality && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{g.nationality}</span>}
                          {g.idNumber && <span className="flex items-center gap-0.5"><CreditCard className="h-3 w-3" />{g.idNumber}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="ml-13">
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Provider: <span className="text-foreground">{g.provider?.name || "Unknown"}</span></p>
                      {g.reservations.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-muted-foreground">Recent Stays:</p>
                          {g.reservations.slice(0, 3).map((r) => (
                            <div key={r.id} className="flex items-center gap-2 text-[10px] text-muted-foreground ml-2">
                              <Building2 className="h-2.5 w-2.5" />
                              <span>{r.room?.number}</span>
                              <Calendar className="h-2.5 w-2.5" />
                              <span>{r.checkIn} → {r.checkOut}</span>
                              <Badge className={`text-[8px] ${STATUS_COLORS[r.status] || ""}`}>{r.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {guests.length === 0 && matches.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-emerald-600 font-medium">No watchlist match found</p>
                <p className="text-xs text-muted-foreground mt-1">This guest is not on the suspected persons list</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Offline Mode Info */}
      <Card className="bg-muted/30">
        <CardContent className="flex items-center gap-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <ScanLine className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium">Offline Capable</p>
            <p className="text-[10px] text-muted-foreground">Suspected persons data is cached locally for offline scanning. Manual entry works without internet connection.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
