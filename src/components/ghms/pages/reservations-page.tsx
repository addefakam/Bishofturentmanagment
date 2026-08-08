"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetReservations,
  apiCreateReservation,
  apiDeleteReservation,
  apiCheckin,
  apiCheckout,
  apiCancelReservation,
  apiCreatePayment,
  apiGetGuests,
  apiGetRooms,
  apiCreateGuest,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreVertical,
  Trash2,
  LogIn,
  LogOut,
  XCircle,
  CreditCard,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  User,
  BedDouble,
  Clock,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  UserCheck,
} from "lucide-react";

interface GuestOption {
  id: string;
  name: string;
  phone: string;
}

interface RoomOption {
  id: string;
  number: string;
  name: string;
  type: string;
  status: string;
  pricePerNight: number;
}

interface Reservation {
  id: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomRate: number;
  totalCost: number;
  paidAmount: number;
  balance: number;
  paymentStatus: string;
  paymentMethod: string | null;
  status: string;
  notes: string;
  taxAmount: number;
  discountAmount: number;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  createdAt: string;
  guest?: { id: string; name: string; phone: string };
  room?: { id: string; number: string; name: string; type: string };
}

const STATUS_TABS = ["ALL", "UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"] as const;

const STATUS_BADGE: Record<string, string> = {
  UPCOMING: "bg-sky-100 text-sky-800 border-sky-200",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIAL: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING: "bg-gray-100 text-gray-600 border-gray-200",
};

const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "MOBILE"] as const;

export default function ReservationsPage() {
  const { refreshKey, triggerRefresh } = useAppStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allGuests, setAllGuests] = useState<GuestOption[]>([]);
  const [allRooms, setAllRooms] = useState<RoomOption[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  
  // Step 1 — guest selection / creation
  const [guestMode, setGuestMode] = useState<"existing" | "new">("existing");
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [newGuestForm, setNewGuestForm] = useState({
    name: "",
    phone: "",
    email: "",
    idNumber: "",
    idType: "National ID",
    nationality: "",
    address: "",
    notes: "",
  });

  // Step 2 — booking details
  const [createForm, setCreateForm] = useState({
    roomId: "",
    checkIn: "",
    checkOut: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Reservation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState<Reservation | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "CASH",
    referenceNo: "",
    notes: "",
  });
  const [paying, setPaying] = useState(false);

  // Action confirmations
  const [confirmAction, setConfirmAction] = useState<{
    type: "checkin" | "checkout" | "cancel";
    reservation: Reservation;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [resData, guestData, roomData] = await Promise.all([
        apiGetReservations(),
        apiGetGuests(),
        apiGetRooms(),
      ]);
      setReservations(Array.isArray(resData) ? resData : []);
      setAllGuests((Array.isArray(guestData) ? guestData : []).map((g: GuestOption) => ({
        id: g.id,
        name: g.name,
        phone: g.phone,
      })));
      const rawRooms = (roomData.rooms || []);
      setAllRooms(
        rawRooms.map((r: RoomOption) => ({
          id: r.id,
          number: r.number,
          name: r.name,
          type: r.type,
          status: r.status,
          pricePerNight: r.pricePerNight,
        }))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  // Available rooms for new reservation (AVAILABLE or RESERVED)
  const availableRooms = useMemo(
    () => allRooms.filter((r) => r.status === "AVAILABLE" || r.status === "RESERVED"),
    [allRooms]
  );

  // Computed nights and total for create form
  const createNights = useMemo(() => {
    if (!createForm.checkIn || !createForm.checkOut) return 0;
    const diff = new Date(createForm.checkOut).getTime() - new Date(createForm.checkIn).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [createForm.checkIn, createForm.checkOut]);

  const createRate = useMemo(() => {
    const room = allRooms.find((r) => r.id === createForm.roomId);
    return room ? room.pricePerNight : 0;
  }, [createForm.roomId, allRooms]);

  const createTotal = createNights * createRate;

  // Filtered reservations
  const filtered = useMemo(() => {
    let list = reservations;
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.guest?.name?.toLowerCase().includes(q) ||
          r.room?.number?.toLowerCase().includes(q) ||
          r.room?.name?.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reservations, statusFilter, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleCreate = async () => {
    if (!createForm.roomId || !createForm.checkIn || !createForm.checkOut) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (createNights < 1) {
      toast.error("Check-out must be after check-in");
      return;
    }
    try {
      setCreating(true);

      // Determine guestId: use existing or create new
      let guestId = selectedGuestId;
      if (guestMode === "new") {
        if (!newGuestForm.name || !newGuestForm.phone) {
          toast.error("Guest name and phone are required");
          return;
        }
        const created = await apiCreateGuest(newGuestForm);
        guestId = created.id;
      }

      if (!guestId) {
        toast.error("Please select or create a guest");
        return;
      }

      await apiCreateReservation({
        guestId,
        roomId: createForm.roomId,
        checkIn: createForm.checkIn,
        checkOut: createForm.checkOut,
        notes: createForm.notes,
      });

      toast.success("Guest and reservation created successfully");
      closeCreateDialog();
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create reservation";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setGuestMode("existing");
    setSelectedGuestId("");
    setNewGuestForm({ name: "", phone: "", email: "", idNumber: "", idType: "National ID", nationality: "", address: "", notes: "" });
    setCreateForm({ roomId: "", checkIn: "", checkOut: "", notes: "" });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiDeleteReservation(deleteTarget.id);
      toast.success("Reservation deleted");
      setDeleteTarget(null);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete reservation";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleAction = async () => {
    if (!confirmAction) return;
    const { type, reservation } = confirmAction;
    try {
      setActionLoading(true);
      if (type === "checkin") {
        await apiCheckin(reservation.id);
        toast.success("Guest checked in successfully");
      } else if (type === "checkout") {
        await apiCheckout(reservation.id);
        toast.success("Guest checked out successfully");
      } else if (type === "cancel") {
        await apiCancelReservation(reservation.id);
        toast.success("Reservation cancelled");
      }
      setConfirmAction(null);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to ${type}`;
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentDialog || !paymentForm.amount) {
      toast.error("Payment amount is required");
      return;
    }
    const amount = Number(paymentForm.amount);
    if (amount <= 0) {
      toast.error("Amount must be positive");
      return;
    }
    if (amount > paymentDialog.balance) {
      toast.error(`Amount exceeds balance of ${formatCurrency(paymentDialog.balance)}`);
      return;
    }
    try {
      setPaying(true);
      await apiCreatePayment({
        reservationId: paymentDialog.id,
        amount,
        method: paymentForm.method,
        referenceNo: paymentForm.referenceNo,
        notes: paymentForm.notes,
      });
      toast.success(`Payment of ${formatCurrency(amount)} recorded`);
      setPaymentDialog(null);
      setPaymentForm({ amount: "", method: "CASH", referenceNo: "", notes: "" });
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to record payment";
      toast.error(message);
    } finally {
      setPaying(false);
    }
  };

  const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; className: string; description: string }> = {
    checkin: {
      label: "Check In",
      icon: <LogIn className="h-4 w-4" />,
      className: "bg-emerald-600 hover:bg-emerald-700",
      description: `Check in ${confirmAction?.reservation.guest?.name || "guest"} for Room ${confirmAction?.reservation.room?.number || ""}?`,
    },
    checkout: {
      label: "Check Out",
      icon: <LogOut className="h-4 w-4" />,
      className: "bg-sky-600 hover:bg-sky-700",
      description: `Check out ${confirmAction?.reservation.guest?.name || "guest"} from Room ${confirmAction?.reservation.room?.number || ""}?`,
    },
    cancel: {
      label: "Cancel Reservation",
      icon: <XCircle className="h-4 w-4" />,
      className: "bg-rose-600 hover:bg-rose-700",
      description: `Cancel reservation for ${confirmAction?.reservation.guest?.name || "guest"}? This action cannot be undone.`,
    },
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
          <p className="mt-1 text-sm text-gray-500">
            {reservations.length} reservation{reservations.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Reservation
        </Button>
      </div>

      {/* Status Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm">
                {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                {tab !== "ALL" && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    ({reservations.filter((r) => tab === "ALL" || r.status === tab).length})
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search reservations..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="min-w-[160px]">Guest</TableHead>
                <TableHead className="min-w-[100px]">Room</TableHead>
                <TableHead className="min-w-[100px]">Check-in</TableHead>
                <TableHead className="min-w-[100px]">Check-out</TableHead>
                <TableHead className="text-center">Nights</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center">
                    <div className="flex flex-col items-center text-gray-400">
                      <CalendarRange className="h-8 w-8 mb-2" />
                      <p className="text-sm font-medium">No reservations found</p>
                      <p className="text-xs mt-0.5">
                        {statusFilter !== "ALL"
                          ? "Try changing the filter"
                          : search
                            ? "Try a different search"
                            : "Create your first reservation"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((res) => (
                  <TableRow key={res.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 text-xs font-medium">
                          {res.guest?.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {res.guest?.name || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-400">{res.guest?.phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {res.room?.number || "—"}
                        </p>
                        <p className="text-xs text-gray-400">{res.room?.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(res.checkIn)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatDate(res.checkOut)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{res.nights}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(res.totalCost)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-emerald-700 font-medium">
                      {formatCurrency(res.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-medium ${res.balance > 0 ? "text-rose-600" : "text-gray-500"}`}>
                        {formatCurrency(res.balance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[res.status] || ""}>
                        {res.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PAYMENT_STATUS_BADGE[res.paymentStatus] || ""}>
                        {res.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {res.status === "UPCOMING" && (
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ type: "checkin", reservation: res })}
                              className="text-emerald-700 focus:text-emerald-700"
                            >
                              <LogIn className="mr-2 h-4 w-4" />
                              Check In
                            </DropdownMenuItem>
                          )}
                          {res.status === "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={() => setConfirmAction({ type: "checkout", reservation: res })}
                              className="text-sky-700 focus:text-sky-700"
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              Check Out
                            </DropdownMenuItem>
                          )}
                          {(res.status === "UPCOMING" || res.status === "ACTIVE") && res.balance > 0 && (
                            <DropdownMenuItem
                              onClick={() => {
                                setPaymentDialog(res);
                                setPaymentForm({ amount: "", method: "CASH", referenceNo: "", notes: "" });
                              }}
                              className="text-amber-700 focus:text-amber-700"
                            >
                              <CreditCard className="mr-2 h-4 w-4" />
                              Record Payment
                            </DropdownMenuItem>
                          )}
                          {(res.status === "UPCOMING" || res.status === "ACTIVE") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({ type: "cancel", reservation: res })}
                                className="text-rose-600 focus:text-rose-600"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => setDeleteTarget(res)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-gray-500">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of{" "}
              {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm text-gray-600">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 md:hidden">
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
            <CalendarRange className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-lg font-medium text-gray-500">No reservations</p>
          </div>
        ) : (
          paged.map((res) => (
            <div key={res.id} className="rounded-xl border bg-white p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-semibold text-sm">
                    {res.guest?.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-gray-900 text-sm">{res.guest?.name || "Unknown"}</h3>
                      <Badge variant="outline" className={`${STATUS_BADGE[res.status]} text-[10px] px-1.5 py-0`}>
                        {res.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500">
                      Room {res.room?.number} · {res.room?.name}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {res.status === "UPCOMING" && (
                      <DropdownMenuItem onClick={() => setConfirmAction({ type: "checkin", reservation: res })}>
                        <LogIn className="mr-2 h-4 w-4" /> Check In
                      </DropdownMenuItem>
                    )}
                    {res.status === "ACTIVE" && (
                      <DropdownMenuItem onClick={() => setConfirmAction({ type: "checkout", reservation: res })}>
                        <LogOut className="mr-2 h-4 w-4" /> Check Out
                      </DropdownMenuItem>
                    )}
                    {res.balance > 0 && (res.status === "UPCOMING" || res.status === "ACTIVE") && (
                      <DropdownMenuItem onClick={() => { setPaymentDialog(res); setPaymentForm({ amount: "", method: "CASH", referenceNo: "", notes: "" }); }}>
                        <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                      </DropdownMenuItem>
                    )}
                    {(res.status === "UPCOMING" || res.status === "ACTIVE") && (
                      <DropdownMenuItem className="text-rose-600" onClick={() => setConfirmAction({ type: "cancel", reservation: res })}>
                        <XCircle className="mr-2 h-4 w-4" /> Cancel
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1 text-gray-500">
                  <CalendarDays className="h-3 w-3" /> {formatDate(res.checkIn)} → {formatDate(res.checkOut)}
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Clock className="h-3 w-3" /> {res.nights} night{res.nights !== 1 ? "s" : ""}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-semibold">{formatCurrency(res.totalCost)}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={PAYMENT_STATUS_BADGE[res.paymentStatus]}>
                      {res.paymentStatus}
                    </Badge>
                  </div>
                  {res.balance > 0 && (
                    <p className="text-xs text-rose-600 font-medium mt-1">
                      Balance: {formatCurrency(res.balance)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <span className="text-sm text-gray-500">{page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

       {/* ── Unified Guest Registration + Room Reservation Dialog ── */}
      <Dialog open={createOpen} onOpenChange={closeCreateDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-emerald-600" />
              New Guest Registration &amp; Room Reservation
            </DialogTitle>
            <DialogDescription>
              Register a new guest and book a room in one step, or look up a returning guest by ID / phone.
            </DialogDescription>
          </DialogHeader>

          {/* ── Guest Mode Toggle ── */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={() => { setGuestMode("new"); setSelectedGuestId(""); }}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                guestMode === "new"
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <UserPlus className="h-4 w-4" />
              New Guest
            </button>
            <button
              onClick={() => { setGuestMode("existing"); setNewGuestForm({ name: "", phone: "", email: "", idNumber: "", idType: "National ID", nationality: "", address: "", notes: "" }); }}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                guestMode === "existing"
                  ? "border-violet-400 bg-violet-50 text-violet-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Returning Guest
            </button>
          </div>

          {/* ── Two-column layout ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ══ LEFT: Guest Information ══ */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <User className="h-4 w-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-gray-800">Guest Information</h3>
              </div>

              {guestMode === "existing" ? (
                /* Returning guest — search by ID or phone */
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Search by ID Number or Phone</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter ID number or phone..."
                        value={newGuestForm.idNumber}
                        onChange={(e) => setNewGuestForm({ ...newGuestForm, idNumber: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const q = newGuestForm.idNumber.toLowerCase();
                            const found = allGuests.find(
                              (g) =>
                                g.phone.toLowerCase().includes(q) ||
                                ("idNumber" in g && String((g as {idNumber?: string}).idNumber).toLowerCase().includes(q))
                            ) || allGuests.find((g) =>
                              g.name.toLowerCase().includes(q)
                            );
                            if (found) {
                              setSelectedGuestId(found.id);
                              const full = allGuests.find(x => x.id === found.id);
                              if (full) setNewGuestForm({ name: full.name, phone: full.phone, email: "", idNumber: newGuestForm.idNumber, idType: "National ID", nationality: "", address: "", notes: "" });
                              toast.success(`Found: ${found.name}`);
                            } else {
                              toast.error("No guest found with that ID / phone");
                            }
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const q = newGuestForm.idNumber.toLowerCase();
                          const found = allGuests.find(
                            (g) => g.phone.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
                          );
                          if (found) {
                            setSelectedGuestId(found.id);
                            setNewGuestForm({ name: found.name, phone: found.phone, email: "", idNumber: newGuestForm.idNumber, idType: "National ID", nationality: "", address: "", notes: "" });
                            toast.success(`Found: ${found.name}`);
                          } else {
                            toast.error("No guest found — check ID or phone");
                          }
                        }}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400">Press Enter or click Search, then confirm the details below</p>
                  </div>

                  {/* Guest dropdown fallback */}
                  <div className="space-y-1.5">
                    <Label>Or Pick from List</Label>
                    {allGuests.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 py-3 text-center text-xs text-gray-400">
                        No guests on file yet
                      </div>
                    ) : (
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                        {allGuests.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              setSelectedGuestId(g.id);
                              setNewGuestForm({ name: g.name, phone: g.phone, email: "", idNumber: "", idType: "National ID", nationality: "", address: "", notes: "" });
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              selectedGuestId === g.id
                                ? "bg-violet-50 text-violet-800"
                                : "bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="font-medium">{g.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">{g.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preview of selected guest */}
                  {selectedGuestId && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-1">
                      <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Selected Guest</p>
                      <p className="text-sm font-bold text-violet-900">{newGuestForm.name}</p>
                      <p className="text-xs text-violet-700">{newGuestForm.phone}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* New guest — full registration form */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Full Name <span className="text-rose-500">*</span></Label>
                      <Input
                        placeholder="John Doe"
                        value={newGuestForm.name}
                        onChange={(e) => setNewGuestForm({ ...newGuestForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone <span className="text-rose-500">*</span></Label>
                      <Input
                        placeholder="+251 9XX XXX XXX"
                        value={newGuestForm.phone}
                        onChange={(e) => setNewGuestForm({ ...newGuestForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        placeholder="guest@email.com"
                        value={newGuestForm.email}
                        onChange={(e) => setNewGuestForm({ ...newGuestForm, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nationality</Label>
                      <Input
                        placeholder="Ethiopian"
                        value={newGuestForm.nationality}
                        onChange={(e) => setNewGuestForm({ ...newGuestForm, nationality: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label>ID Type</Label>
                      <Select value={newGuestForm.idType} onValueChange={(v) => setNewGuestForm({ ...newGuestForm, idType: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["National ID", "Passport", "Driver's License", "Other"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>ID Number</Label>
                      <Input
                        placeholder="ID / Passport no."
                        value={newGuestForm.idNumber}
                        onChange={(e) => setNewGuestForm({ ...newGuestForm, idNumber: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Address</Label>
                    <Input
                      placeholder="Street / City"
                      value={newGuestForm.address}
                      onChange={(e) => setNewGuestForm({ ...newGuestForm, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea
                      placeholder="Any special notes about the guest..."
                      rows={2}
                      value={newGuestForm.notes}
                      onChange={(e) => setNewGuestForm({ ...newGuestForm, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ══ RIGHT: Booking Details ══ */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <BedDouble className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-gray-800">Booking Details</h3>
              </div>

              <div className="space-y-1.5">
                <Label>Room <span className="text-rose-500">*</span></Label>
                {availableRooms.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
                    No available rooms
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                    {availableRooms.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, roomId: r.id })}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                          createForm.roomId === r.id
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="flex items-center gap-2 font-medium">
                          <BedDouble className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          Room {r.number}
                          <span className="text-xs text-gray-400 font-normal">— {r.type}</span>
                        </span>
                        <span className={`text-xs font-semibold ${createForm.roomId === r.id ? "text-emerald-700" : "text-gray-500"}`}>
                          {formatCurrency(r.pricePerNight)}/night
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {createForm.roomId && (
                  <p className="text-xs text-emerald-600 font-medium">
                    ✓ Room {availableRooms.find(r => r.id === createForm.roomId)?.number} selected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ci-date">Check-in <span className="text-rose-500">*</span></Label>
                  <Input
                    id="ci-date"
                    type="date"
                    value={createForm.checkIn}
                    onChange={(e) => setCreateForm({ ...createForm, checkIn: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="co-date">Check-out <span className="text-rose-500">*</span></Label>
                  <Input
                    id="co-date"
                    type="date"
                    value={createForm.checkOut}
                    min={createForm.checkIn}
                    onChange={(e) => setCreateForm({ ...createForm, checkOut: e.target.value })}
                  />
                </div>
              </div>

              {/* Price Summary */}
              {(createNights > 0 && createForm.roomId) && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Price Summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Room Rate</span>
                    <span className="font-medium">{formatCurrency(createRate)}/night</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Nights</span>
                    <span className="font-medium">{createNights}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-emerald-700">{formatCurrency(createTotal)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="bk-notes">Booking Notes</Label>
                <Textarea
                  id="bk-notes"
                  placeholder="Special requests, room preferences..."
                  rows={3}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex-row gap-2 justify-end">
            <Button variant="outline" onClick={closeCreateDialog}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.roomId || !createForm.checkIn || !createForm.checkOut || (guestMode === "new" ? !newGuestForm.name || !newGuestForm.phone : !selectedGuestId)}
              className="gap-2"
            >
              {creating ? "Saving..." : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {guestMode === "new" ? "Register Guest & Book Room" : "Book Room"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog (Check-in / Check-out / Cancel) */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmAction && ACTION_LABELS[confirmAction.type]?.icon}
              {confirmAction && ACTION_LABELS[confirmAction.type]?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && ACTION_LABELS[confirmAction.type]?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction ? ACTION_LABELS[confirmAction.type]?.className : ""}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : confirmAction && ACTION_LABELS[confirmAction.type]?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={() => setPaymentDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-500" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              {paymentDialog && (
                <>
                  For {paymentDialog.guest?.name} — Room {paymentDialog.room?.number} · Balance:{" "}
                  <span className="font-semibold text-rose-600">
                    {formatCurrency(paymentDialog.balance)}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {paymentDialog && (
            <div className="space-y-4 py-2">
              {/* Payment summary bar */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 p-2 border">
                  <p className="text-[10px] uppercase text-gray-500 tracking-wider">Total</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(paymentDialog.totalCost)}</p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 border border-emerald-100">
                  <p className="text-[10px] uppercase text-emerald-600 tracking-wider">Paid</p>
                  <p className="text-sm font-bold text-emerald-700">{formatCurrency(paymentDialog.paidAmount)}</p>
                </div>
                <div className="rounded-lg bg-rose-50 p-2 border border-rose-100">
                  <p className="text-[10px] uppercase text-rose-600 tracking-wider">Balance</p>
                  <p className="text-sm font-bold text-rose-700">{formatCurrency(paymentDialog.balance)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-amount">
                  Amount <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="pay-amount"
                  type="number"
                  placeholder="0"
                  min="0"
                  max={paymentDialog.balance}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
                {paymentForm.amount && Number(paymentForm.amount) > 0 && (
                  <p className="text-xs text-gray-500">
                    After payment: {formatCurrency(paymentDialog.balance - Number(paymentForm.amount))} remaining
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentForm.method}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, method: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m.charAt(0) + m.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-ref">Reference Number</Label>
                <Input
                  id="pay-ref"
                  placeholder="Transaction reference"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-notes">Notes</Label>
                <Textarea
                  id="pay-notes"
                  placeholder="Payment notes..."
                  rows={2}
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>

              {/* Quick amount buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setPaymentForm({ ...paymentForm, amount: String(paymentDialog.balance) })}
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Full Balance
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setPaymentForm({ ...paymentForm, amount: String(paymentDialog.totalCost) })}
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  Full Total
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handlePayment} disabled={paying} className="bg-amber-600 hover:bg-amber-700">
              {paying ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the reservation for {deleteTarget?.guest?.name} (Room{" "}
              {deleteTarget?.room?.number}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}