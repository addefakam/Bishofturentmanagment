"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useAppStore } from "@/lib/store";
import { apiPoliceGuests } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Phone,
  Mail,
  MapPin,
  Globe,
  CreditCard,
  Calendar,
  Star,
  UserCircle,
  Building2,
  BedDouble,
} from "lucide-react";

interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string;
  idNumber: string;
  idType: string;
  nationality: string;
  address: string;
  notes: string;
  vip: boolean;
  totalSpent: number;
  totalStays: number;
  providerId: string;
  createdAt: string;
  updatedAt: string;
  provider: { id: string; name: string } | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", minimumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PoliceGuestsPage() {
  const { refreshKey } = useAppStore();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch ALL guests once, filter client-side
  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiPoliceGuests("");
      setGuests(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load guests";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuests(); }, [fetchGuests, refreshKey]);

  // Client-side search filter — instant character-by-character
  const filteredGuests = useMemo(() => {
    if (!search.trim()) return guests;
    const q = search.toLowerCase().trim();
    return guests.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.phone.toLowerCase().includes(q) ||
      g.idNumber.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.nationality.toLowerCase().includes(q) ||
      (g.provider?.name || "").toLowerCase().includes(q)
    );
  }, [guests, search]);

  const pagination = usePagination({ totalItems: filteredGuests.length, initialPageSize: 10, pageSizeOptions: [5, 10, 20, 50] });

  // Reset to page 1 when search changes
  useEffect(() => { pagination.resetToFirst(); }, [search]);
  const paginatedGuests = useMemo(() => pagination.paginate(filteredGuests), [filteredGuests, pagination]);

  const openDetail = (guest: Guest) => {
    setSelectedGuest(guest);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Guest Registry</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Search across all providers
          </p>
        </div>
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name, phone, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 sm:h-10"
          />
        </div>
      </div>

      {/* Results count */}
      {!loading && filteredGuests.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {filteredGuests.length} guest{filteredGuests.length !== 1 ? "s" : ""} found
          {search ? ` for "${search}"` : ""}
        </p>
      )}

      {/* Guest List — Cards on mobile, Table on md+ */}
      <div className="rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4 sm:p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full sm:h-12" />
            ))}
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <UserCircle className="mb-3 h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {search ? "No guests match your search" : "No guests registered yet"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="divide-y md:hidden">
              {paginatedGuests.map((guest) => (
                <button
                  key={guest.id}
                  className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted/80"
                  onClick={() => openDetail(guest)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <UserCircle className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{guest.name}</p>
                      {guest.vip && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{guest.phone}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Building2 className="h-2.5 w-2.5" />
                        {guest.provider?.name || "Unknown"}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <BedDouble className="h-2.5 w-2.5" />
                        {guest.totalStays} stay{guest.totalStays !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600">
                        {formatCurrency(guest.totalSpent)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>ID Type</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Total Spent</TableHead>
                    <TableHead className="text-center">Stays</TableHead>
                    <TableHead className="text-center">VIP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGuests.map((guest) => (
                    <TableRow
                      key={guest.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(guest)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {guest.name}
                          {guest.vip && (
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{guest.phone}</TableCell>
                      <TableCell className="font-mono text-sm">{guest.idNumber || "—"}</TableCell>
                      <TableCell>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium">
                          {guest.idType || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {guest.nationality ? (
                            <>
                              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm">{guest.nationality}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {guest.provider?.name || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(guest.totalSpent)}</TableCell>
                      <TableCell className="text-center">{guest.totalStays}</TableCell>
                      <TableCell className="text-center">
                        {guest.vip ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
                            VIP
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Guest Detail Dialog — mobile optimized */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              <UserCircle className="h-5 w-5" />
              {selectedGuest?.name}
              {selectedGuest?.vip && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs">
                  VIP
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {selectedGuest?.provider?.name || "Unknown Provider"}
            </DialogDescription>
          </DialogHeader>
          {selectedGuest && (
            <div className="space-y-4">
              {/* Quick stats row — always visible, stack on very small */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="rounded-lg border bg-muted/30 p-2.5 sm:p-3 text-center">
                  <CreditCard className="mx-auto mb-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                  <p className="text-sm sm:text-lg font-bold leading-tight">{formatCurrency(selectedGuest.totalSpent)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Spent</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2.5 sm:p-3 text-center">
                  <p className="text-sm sm:text-lg font-bold leading-tight">{selectedGuest.totalStays}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Stays</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-2.5 sm:p-3 text-center">
                  <p className="text-sm sm:text-lg font-bold leading-tight">{selectedGuest.vip ? "Yes" : "No"}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">VIP</p>
                </div>
              </div>

              <Separator />

              {/* Contact & ID details — stacked on mobile */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedGuest.phone}</p>
                  </div>
                </div>
                {selectedGuest.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedGuest.email}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-slate-100 text-[8px] font-bold text-slate-600">ID</span>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedGuest.idType || "ID Number"}
                    </p>
                    <p className="font-mono font-medium">
                      {selectedGuest.idNumber || "—"}
                    </p>
                  </div>
                </div>
                {selectedGuest.nationality && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Nationality</p>
                      <p className="font-medium">{selectedGuest.nationality}</p>
                    </div>
                  </div>
                )}
                {selectedGuest.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Address</p>
                      <p className="font-medium">{selectedGuest.address}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Registered</p>
                    <p className="font-medium">{formatDate(selectedGuest.createdAt)}</p>
                  </div>
                </div>
              </div>

              {selectedGuest.notes && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs">Notes</Label>
                    <p className="rounded-lg bg-muted/50 p-3 text-xs sm:text-sm">{selectedGuest.notes}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagination Controls */}
      {!loading && filteredGuests.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          totalItems={filteredGuests.length}
          rangeInfo={pagination.rangeInfo}
          goToPage={pagination.goToPage}
          setPageSize={pagination.setPageSize}
        />
      )}
    </div>
  );
}