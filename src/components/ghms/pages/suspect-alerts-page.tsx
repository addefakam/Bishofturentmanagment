"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useAppStore } from "@/lib/store";
import { apiGetSuspectMatches, apiMarkMatchesRead } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldAlert,
  CheckCheck,
  MapPin,
  Phone,
  CreditCard,
  Calendar,
  BedDouble,
  Sun,
  UserCircle,
  Building2,
  Clock,
  FileWarning,
} from "lucide-react";

interface SuspectInfo {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  severity: string;
  description: string;
}

interface Match {
  id: string;
  matchType: string;
  guestName: string;
  guestPhone: string;
  guestIdNumber: string;
  providerName: string;
  providerId: string;
  reservationId: string | null;
  daytimeBookingId: string | null;
  details: string;
  isRead: boolean;
  createdAt: string;
  suspectedPerson: SuspectInfo;
}

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  RESERVATION: "Room Reservation",
  DAYTIME_BOOKING: "Daytime Service",
  GUEST_CHECKIN: "Guest Registration",
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
  });
}

function parseDetails(detailsStr: string): Record<string, unknown> {
  try {
    return JSON.parse(detailsStr);
  } catch {
    return {};
  }
}

export default function SuspectAlertsPage() {
  const { refreshKey, triggerRefresh } = useAppStore();
  const [matches, setMatches] = useState<Match[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const pagination = usePagination({ totalItems: matches.length, initialPageSize: 10, pageSizeOptions: [5, 10, 20, 50] });

  // Reset to page 1 when filter changes
  useEffect(() => { pagination.resetToFirst(); }, [filter]);
  const paginatedMatches = useMemo(() => pagination.paginate(matches), [matches, pagination]);

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const query = filter === "unread" ? "unread=true" : "";
      const data = await apiGetSuspectMatches(query);
      setMatches(data.matches || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load alerts";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches, refreshKey]);

  const openDetail = (match: Match) => {
    setSelectedMatch(match);
    setDetailOpen(true);
    // Mark as read when opening
    if (!match.isRead) {
      apiMarkMatchesRead({ ids: [match.id] }).then(() => {
        setMatches((prev) =>
          prev.map((m) => (m.id === match.id ? { ...m, isRead: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      });
    }
  };

  const markAllRead = async () => {
    try {
      await apiMarkMatchesRead({ markAllRead: true });
      setMatches((prev) => prev.map((m) => ({ ...m, isRead: true })));
      setUnreadCount(0);
      toast.success("All alerts marked as read");
    } catch (err: unknown) {
      toast.error("Failed to mark all as read");
    }
  };

  const details = selectedMatch ? parseDetails(selectedMatch.details) : {};

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">Suspect Alerts</h2>
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white hover:bg-red-600 text-[10px] px-1.5">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Automatic alerts when suspected persons make reservations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === "all" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === "unread" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Pagination Controls */}
      {!loading && matches.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          totalItems={matches.length}
          rangeInfo={pagination.rangeInfo}
          goToPage={pagination.goToPage}
          setPageSize={pagination.setPageSize}
        />
      )}

      {/* Alerts List */}
      <div className="rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4 sm:p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full sm:h-14" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <ShieldAlert className="mb-3 h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {filter === "unread"
                ? "No unread alerts"
                : "No suspect match alerts yet"}
            </p>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground/70">
              Alerts appear here when a suspected person makes a reservation
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="divide-y md:hidden">
              {paginatedMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => openDetail(match)}
                  className={`flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted/80 ${
                    !match.isRead ? "bg-red-50/40" : ""
                  }`}
                >
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    match.isRead ? "bg-slate-100" : "bg-red-100"
                  }`}>
                    <ShieldAlert className={`h-4 w-4 ${match.isRead ? "text-slate-500" : "text-red-600"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {!match.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                      <p className="truncate text-sm font-medium">{match.guestName}</p>
                      <Badge variant="outline" className={`shrink-0 text-[9px] ${SEVERITY_STYLES[match.suspectedPerson.severity] || ""}`}>
                        {match.suspectedPerson.severity}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Matched: {match.suspectedPerson.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Building2 className="h-2.5 w-2.5" />
                        {match.providerName || "Unknown"}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <FileWarning className="h-2.5 w-2.5" />
                        {MATCH_TYPE_LABELS[match.matchType] || match.matchType}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDateTime(match.createdAt)}
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
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Matched Guest</TableHead>
                    <TableHead>Suspect Name</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Match Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Detected At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMatches.map((match) => (
                    <TableRow
                      key={match.id}
                      className={`cursor-pointer hover:bg-muted/50 ${!match.isRead ? "bg-red-50/40" : ""}`}
                      onClick={() => openDetail(match)}
                    >
                      <TableCell>
                        {!match.isRead && (
                          <span className="block h-2.5 w-2.5 rounded-full bg-red-500" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{match.guestName}</p>
                          {match.guestPhone && (
                            <p className="text-xs text-muted-foreground font-mono">{match.guestPhone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-red-700">{match.suspectedPerson.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={SEVERITY_STYLES[match.suspectedPerson.severity] || ""}>
                          {match.suspectedPerson.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{MATCH_TYPE_LABELS[match.matchType] || match.matchType}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{match.providerName || "Unknown"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(match.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Suspect Match Alert
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {formatDateTime(selectedMatch?.createdAt || "")}
            </DialogDescription>
          </DialogHeader>
          {selectedMatch && (
            <div className="space-y-4">
              {/* Suspect Info */}
              <div className="rounded-lg border-2 border-red-200 bg-red-50/50 p-3 sm:p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-700">Suspected Person</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-red-800">{selectedMatch.suspectedPerson.name}</p>
                    <Badge className={SEVERITY_STYLES[selectedMatch.suspectedPerson.severity] || ""}>
                      {selectedMatch.suspectedPerson.severity}
                    </Badge>
                  </div>
                  {selectedMatch.suspectedPerson.phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone className="h-3.5 w-3.5 text-red-600" />
                      <span>{selectedMatch.suspectedPerson.phone}</span>
                    </div>
                  )}
                  {selectedMatch.suspectedPerson.idNumber && (
                    <div className="flex items-center gap-2 text-xs">
                      <FileWarning className="h-3.5 w-3.5 text-red-600" />
                      <span>ID: {selectedMatch.suspectedPerson.idNumber}</span>
                    </div>
                  )}
                  {selectedMatch.suspectedPerson.description && (
                    <p className="text-xs text-red-700/80 mt-1 bg-red-100/50 rounded p-2">
                      {selectedMatch.suspectedPerson.description}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Matched Person Info */}
              <div className="space-y-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matched Guest</p>
                <div className="flex items-center gap-2.5">
                  <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedMatch.guestName}</p>
                    {selectedMatch.guestPhone && <p className="text-xs text-muted-foreground">{selectedMatch.guestPhone}</p>}
                  </div>
                </div>
                {selectedMatch.guestIdNumber && (
                  <div className="flex items-center gap-2.5">
                    <FileWarning className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="font-mono text-xs">ID: {selectedMatch.guestIdNumber}</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Location & Booking Details */}
              <div className="space-y-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location & Booking</p>
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Service Provider</p>
                    <p className="font-medium">{selectedMatch.providerName || "Unknown"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Badge variant="outline" className="text-xs">
                    {MATCH_TYPE_LABELS[selectedMatch.matchType] || selectedMatch.matchType}
                  </Badge>
                </div>

                {/* Dynamic details based on match type */}
                {selectedMatch.matchType === "RESERVATION" && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                    {details.checkIn && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Check-in</p>
                          <p className="text-xs font-medium">{String(details.checkIn)}</p>
                        </div>
                      </div>
                    )}
                    {details.checkOut && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Check-out</p>
                          <p className="text-xs font-medium">{String(details.checkOut)}</p>
                        </div>
                      </div>
                    )}
                    {details.roomNumber && (
                      <div className="flex items-center gap-2">
                        <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Room</p>
                          <p className="text-xs font-medium">{String(details.roomNumber)}</p>
                        </div>
                      </div>
                    )}
                    {details.nights && (
                      <div className="flex items-center gap-2">
                        <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Nights</p>
                          <p className="text-xs font-medium">{String(details.nights)}</p>
                        </div>
                      </div>
                    )}
                    {details.totalCost !== undefined && (
                      <div className="col-span-2 flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Cost</p>
                          <p className="text-xs font-medium">ETB {Number(details.totalCost).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedMatch.matchType === "DAYTIME_BOOKING" && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                    {details.date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Date</p>
                          <p className="text-xs font-medium">{String(details.date)}</p>
                        </div>
                      </div>
                    )}
                    {details.time && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Time</p>
                          <p className="text-xs font-medium">{String(details.time)}</p>
                        </div>
                      </div>
                    )}
                    {details.serviceName && (
                      <div className="col-span-2 flex items-center gap-2">
                        <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Service</p>
                          <p className="text-xs font-medium">{String(details.serviceName)}</p>
                        </div>
                      </div>
                    )}
                    {details.totalCost !== undefined && (
                      <div className="col-span-2 flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Total Cost</p>
                          <p className="text-xs font-medium">ETB {Number(details.totalCost).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedMatch.matchType === "GUEST_CHECKIN" && (
                  <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3">
                    {details.nationality && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Nationality</p>
                          <p className="text-xs font-medium">{String(details.nationality)}</p>
                        </div>
                      </div>
                    )}
                    {details.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Address</p>
                          <p className="text-xs font-medium">{String(details.address)}</p>
                        </div>
                      </div>
                    )}
                    {details.email && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-[10px] text-muted-foreground">Email</p>
                          <p className="text-xs font-medium">{String(details.email)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}