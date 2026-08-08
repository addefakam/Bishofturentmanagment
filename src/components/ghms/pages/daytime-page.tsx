"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetDaytimeServices,
  apiCreateDaytimeService,
  apiUpdateDaytimeService,
  apiDeleteDaytimeService,
  apiGetDaytimeBookings,
  apiCreateDaytimeBooking,
  apiUpdateDaytimeBooking,
  apiDeleteDaytimeBooking,
  apiCreatePayment,
  apiGetRooms,
} from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sun,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  DollarSign,
  Clock,
  CreditCard,
  CalendarDays,
  BedDouble,
  User,
  CheckCircle2,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
  duration: string;
  description: string;
  active: boolean;
}

interface Booking {
  id: string;
  serviceId: string;
  guestName: string;
  guestPhone: string;
  date: string;
  time: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  paidAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  notes: string;
  service?: { id: string; name: string; category: string };
}

interface Room {
  id: string;
  number: string;
  name: string;
  type: string;
  pricePerNight: number;
  floor: number;
  capacity: number;
  status: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(price);

const PAYMENT_STYLES: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PARTIAL: "bg-amber-100 text-amber-800 border-amber-200",
  PENDING: "bg-rose-100 text-rose-800 border-rose-200",
};

const CATEGORY_COLORS: Record<string, string> = {
  SPA: "bg-purple-50 text-purple-700 border-purple-200",
  FOOD: "bg-orange-50 text-orange-700 border-orange-200",
  LAUNDRY: "bg-sky-50 text-sky-700 border-sky-200",
  TOUR: "bg-teal-50 text-teal-700 border-teal-200",
  TRANSPORT: "bg-slate-50 text-slate-700 border-slate-200",
  GYM: "bg-rose-50 text-rose-700 border-rose-200",
  POOL: "bg-cyan-50 text-cyan-700 border-cyan-200",
  EVENT: "bg-amber-50 text-amber-700 border-amber-200",
  ROOM: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OTHER: "bg-gray-50 text-gray-700 border-gray-200",
};

const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "MOBILE"] as const;



// ─── Component ─────────────────────────────────────────────────────────────

export default function DaytimePage() {
  const { refreshKey, triggerRefresh } = useAppStore();
  const [activeTab, setActiveTab] = useState("room-bookings");

  // ── Rooms ──
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);

  // ── Room Booking dialog ──
  const [rbDialogOpen, setRbDialogOpen] = useState(false);
  const [rbForm, setRbForm] = useState({
    roomId: "", guestName: "", guestPhone: "", date: "", checkInTime: "", checkOutTime: "", price: "", notes: "",
  });
  const [rbSaving, setRbSaving] = useState(false);
  const [rbDeleteTarget, setRbDeleteTarget] = useState<Booking | null>(null);
  const [rbDeleting, setRbDeleting] = useState(false);

  // Room bookings = DaytimeBookings where service.category === "ROOM"
  const [roomBookings, setRoomBookings] = useState<Booking[]>([]);
  const [rbLoading, setRbLoading] = useState(true);

  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [svcLoading, setSvcLoading] = useState(true);
  const [svcDialogOpen, setSvcDialogOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [svcForm, setSvcForm] = useState({ name: "", price: "", category: "", duration: "", description: "" });
  const [svcSaving, setSvcSaving] = useState(false);
  const [svcDeleteTarget, setSvcDeleteTarget] = useState<Service | null>(null);
  const [svcDeleting, setSvcDeleting] = useState(false);

  // Service Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bkLoading, setBkLoading] = useState(true);
  const [bkDialogOpen, setBkDialogOpen] = useState(false);
  const [editingBk, setEditingBk] = useState<Booking | null>(null);
  const [bkForm, setBkForm] = useState({
    serviceId: "", guestName: "", guestPhone: "", date: "", time: "", quantity: "1",
  });
  const [bkSaving, setBkSaving] = useState(false);
  const [bkDeleteTarget, setBkDeleteTarget] = useState<Booking | null>(null);
  const [bkDeleting, setBkDeleting] = useState(false);

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Booking | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "CASH" });
  const [paySaving, setPaySaving] = useState(false);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchRooms = useCallback(async () => {
    try {
      setRoomsLoading(true);
      const data = await apiGetRooms();
      setRooms((data.rooms || []).filter((r: Room) => r.status === "AVAILABLE" || r.status === "RESERVED"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load rooms");
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      setSvcLoading(true);
      const data = await apiGetDaytimeServices();
      setServices(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load services");
    } finally {
      setSvcLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      setBkLoading(true);
      setRbLoading(true);
      const data = await apiGetDaytimeBookings();
      const all: Booking[] = Array.isArray(data) ? data : [];
      setRoomBookings(all.filter((b) => b.service?.category === "ROOM"));
      setBookings(all.filter((b) => b.service?.category !== "ROOM"));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setBkLoading(false);
      setRbLoading(false);
    }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms, refreshKey]);
  useEffect(() => { fetchServices(); }, [fetchServices, refreshKey]);
  useEffect(() => { fetchBookings(); }, [fetchBookings, refreshKey]);

  // ─── Room Booking Logic ───────────────────────────────────────────────────

  const selectedRoom = useMemo(() => rooms.find((r) => r.id === rbForm.roomId), [rooms, rbForm.roomId]);

  const openCreateRb = () => {
    setRbForm({ roomId: "", guestName: "", guestPhone: "", date: "", checkInTime: "", checkOutTime: "", price: "", notes: "" });
    setRbDialogOpen(true);
  };

  const handleSaveRb = async () => {
    if (!rbForm.roomId || !rbForm.guestName || !rbForm.date || !rbForm.price || Number(rbForm.price) <= 0) {
      toast.error("Room, guest name, date, and price are required");
      return;
    }

    try {
      setRbSaving(true);
      const room = rooms.find((r) => r.id === rbForm.roomId)!;

      const fixedPrice = Number(rbForm.price);
      const timeSlot = rbForm.checkInTime && rbForm.checkOutTime
        ? `${rbForm.checkInTime} – ${rbForm.checkOutTime}`
        : rbForm.checkInTime || "";

      // Find or create a ROOM-category DaytimeService for this room
      let svc = services.find((s) => s.category === "ROOM" && s.name === `Room ${room.number}`);
      if (!svc) {
        const created = await apiCreateDaytimeService({
          name: `Room ${room.number}`,
          price: fixedPrice,
          category: "ROOM",
          duration: "daytime",
          description: `Daytime use of Room ${room.number} (${room.type})`,
          active: true,
        });
        svc = created;
        await fetchServices();
      }

      await apiCreateDaytimeBooking({
        serviceId: svc!.id,
        guestName: rbForm.guestName,
        guestPhone: rbForm.guestPhone,
        date: rbForm.date,
        time: timeSlot,
        quantity: 1,
        unitPrice: fixedPrice,
        totalCost: fixedPrice,
        notes: rbForm.notes,
      });

      toast.success(`Room ${room.number} booked for daytime`);
      setRbDialogOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save room booking");
    } finally {
      setRbSaving(false);
    }
  };

  const handleDeleteRb = async () => {
    if (!rbDeleteTarget) return;
    try {
      setRbDeleting(true);
      await apiDeleteDaytimeBooking(rbDeleteTarget.id);
      toast.success("Room booking deleted");
      setRbDeleteTarget(null);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete booking");
    } finally {
      setRbDeleting(false);
    }
  };

  // ─── Service CRUD ─────────────────────────────────────────────────────────

  const openCreateSvc = () => {
    setEditingSvc(null);
    setSvcForm({ name: "", price: "", category: "", duration: "", description: "" });
    setSvcDialogOpen(true);
  };

  const openEditSvc = (svc: Service) => {
    setEditingSvc(svc);
    setSvcForm({ name: svc.name, price: String(svc.price), category: svc.category, duration: svc.duration, description: svc.description });
    setSvcDialogOpen(true);
  };

  const handleSaveSvc = async () => {
    if (!svcForm.name || !svcForm.price) { toast.error("Name and price are required"); return; }
    try {
      setSvcSaving(true);
      const payload = { name: svcForm.name, price: Number(svcForm.price), category: svcForm.category, duration: svcForm.duration, description: svcForm.description, active: editingSvc ? editingSvc.active : true };
      if (editingSvc) { await apiUpdateDaytimeService(editingSvc.id, payload); toast.success("Service updated"); }
      else { await apiCreateDaytimeService(payload); toast.success("Service created"); }
      setSvcDialogOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save service");
    } finally { setSvcSaving(false); }
  };

  const handleDeleteSvc = async () => {
    if (!svcDeleteTarget) return;
    try {
      setSvcDeleting(true);
      await apiDeleteDaytimeService(svcDeleteTarget.id);
      toast.success("Service deleted");
      setSvcDeleteTarget(null);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete service");
    } finally { setSvcDeleting(false); }
  };

  const handleToggleActive = async (svc: Service) => {
    try {
      await apiUpdateDaytimeService(svc.id, { active: !svc.active });
      toast.success(`Service ${svc.active ? "deactivated" : "activated"}`);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle service");
    }
  };

  // ─── Service Booking CRUD ─────────────────────────────────────────────────

  const selectedService = services.find((s) => s.id === bkForm.serviceId);

  const openCreateBk = () => {
    setEditingBk(null);
    setBkForm({ serviceId: "", guestName: "", guestPhone: "", date: "", time: "", quantity: "1" });
    setBkDialogOpen(true);
  };

  const openEditBk = (bk: Booking) => {
    setEditingBk(bk);
    setBkForm({ serviceId: bk.serviceId, guestName: bk.guestName, guestPhone: bk.guestPhone, date: bk.date, time: bk.time, quantity: String(bk.quantity) });
    setBkDialogOpen(true);
  };

  const handleSaveBk = async () => {
    if (!bkForm.serviceId || !bkForm.guestName || !bkForm.date || !bkForm.time) {
      toast.error("Service, guest name, date, and time are required"); return;
    }
    const svc = services.find((s) => s.id === bkForm.serviceId);
    if (!svc) { toast.error("Selected service not found"); return; }
    try {
      setBkSaving(true);
      const qty = Number(bkForm.quantity) || 1;
      const unitPrice = editingBk ? editingBk.unitPrice : svc.price;
      const payload = { serviceId: bkForm.serviceId, guestName: bkForm.guestName, guestPhone: bkForm.guestPhone, date: bkForm.date, time: bkForm.time, quantity: qty, unitPrice, totalCost: unitPrice * qty };
      if (editingBk) { await apiUpdateDaytimeBooking(editingBk.id, payload); toast.success("Booking updated"); }
      else { await apiCreateDaytimeBooking(payload); toast.success("Booking created"); }
      setBkDialogOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save booking");
    } finally { setBkSaving(false); }
  };

  const handleDeleteBk = async () => {
    if (!bkDeleteTarget) return;
    try {
      setBkDeleting(true);
      await apiDeleteDaytimeBooking(bkDeleteTarget.id);
      toast.success("Booking deleted");
      setBkDeleteTarget(null);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete booking");
    } finally { setBkDeleting(false); }
  };

  // ─── Payment Recording ────────────────────────────────────────────────────

  const openPayDialog = (bk: Booking) => {
    setPayTarget(bk);
    setPayForm({ amount: String(bk.totalCost - bk.paidAmount), method: "CASH" });
    setPayDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!payTarget || !payForm.amount || Number(payForm.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      setPaySaving(true);
      const amount = Number(payForm.amount);
      const newPaid = payTarget.paidAmount + amount;
      const newStatus = newPaid >= payTarget.totalCost ? "PAID" : "PARTIAL";
      await apiCreatePayment({ daytimeBookingId: payTarget.id, amount, method: payForm.method });
      await apiUpdateDaytimeBooking(payTarget.id, { paidAmount: newPaid, paymentStatus: newStatus, paymentMethod: payForm.method });
      toast.success(`Payment of ${formatPrice(amount)} recorded`);
      setPayDialogOpen(false);
      setPayTarget(null);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally { setPaySaving(false); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daytime</h1>
          <p className="mt-1 text-sm text-gray-500">Manage daytime room bookings and other services</p>
        </div>
        <Button
          onClick={activeTab === "room-bookings" ? openCreateRb : activeTab === "services" ? openCreateSvc : openCreateBk}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {activeTab === "room-bookings" ? "Book Room (Daytime)" : activeTab === "services" ? "Add Service" : "New Booking"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="room-bookings" className="gap-2">
            <BedDouble className="h-4 w-4" />
            Room Bookings ({roomBookings.length})
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Sun className="h-4 w-4" />
            Services ({services.filter(s => s.category !== "ROOM").length})
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Service Bookings ({bookings.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── Room Bookings Tab ─────────────────────────────────────────────── */}
        <TabsContent value="room-bookings">
          {rbLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : roomBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
              <BedDouble className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-lg font-medium text-gray-500">No daytime room bookings yet</p>
              <p className="mt-1 text-sm text-gray-400">Book a room for a guest to use during the day</p>
              <Button onClick={openCreateRb} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Book Room (Daytime)
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time Slot</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roomBookings.map((bk) => (
                      <TableRow key={bk.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{bk.guestName}</p>
                            {bk.guestPhone && <p className="text-xs text-gray-500">{bk.guestPhone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium text-gray-700">{bk.service?.name || "—"}</span>
                        </TableCell>
                        <TableCell className="text-sm">{bk.date}</TableCell>
                        <TableCell className="text-sm text-gray-600">{bk.time}</TableCell>
                        <TableCell className="text-right text-sm">{bk.quantity}h</TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatPrice(bk.totalCost)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PAYMENT_STYLES[bk.paymentStatus] || PAYMENT_STYLES.PENDING}>
                            {bk.paymentStatus}
                            {bk.paymentStatus === "PARTIAL" && <span className="ml-1 text-xs">({formatPrice(bk.paidAmount)})</span>}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {bk.paymentStatus !== "PAID" && (
                                <DropdownMenuItem onClick={() => openPayDialog(bk)}>
                                  <CreditCard className="mr-2 h-4 w-4" /> Record Payment
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => setRbDeleteTarget(bk)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── Services Tab ────────────────────────────────────────────────── */}
        <TabsContent value="services">
          {svcLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : services.filter(s => s.category !== "ROOM").length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
              <Sun className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-lg font-medium text-gray-500">No services yet</p>
              <p className="mt-1 text-sm text-gray-400">Add services like Spa, Food, Laundry etc.</p>
              <Button onClick={openCreateSvc} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" /> Add Service</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.filter(s => s.category !== "ROOM").map((svc) => {
                const catColor = CATEGORY_COLORS[svc.category.toUpperCase()] || CATEGORY_COLORS.OTHER;
                return (
                  <Card key={svc.id} className={`gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md ${!svc.active ? "opacity-60" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${catColor}`}><Sun className="h-5 w-5" /></div>
                          <div>
                            <h3 className="font-semibold text-gray-900 leading-tight">{svc.name}</h3>
                            {svc.category && <Badge variant="outline" className={`mt-1 text-xs ${catColor}`}>{svc.category}</Badge>}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditSvc(svc)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(svc)}>{svc.active ? "Deactivate" : "Activate"}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => setSvcDeleteTarget(svc)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div className="flex items-center gap-1.5 text-gray-600"><DollarSign className="h-3.5 w-3.5 text-gray-400" />{formatPrice(svc.price)}</div>
                        {svc.duration && <div className="flex items-center gap-1.5 text-gray-600"><Clock className="h-3.5 w-3.5 text-gray-400" />{svc.duration}</div>}
                      </div>
                      {svc.description && <p className="text-xs text-gray-500 line-clamp-2">{svc.description}</p>}
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant="outline" className={svc.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                          {svc.active ? "Active" : "Inactive"}
                        </Badge>
                        <Switch checked={svc.active} onCheckedChange={() => handleToggleActive(svc)} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Service Bookings Tab ─────────────────────────────────────────── */}
        <TabsContent value="bookings">
          {bkLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
              <CalendarDays className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-lg font-medium text-gray-500">No service bookings yet</p>
              <p className="mt-1 text-sm text-gray-400">Create a booking when a guest uses a daytime service</p>
              <Button onClick={openCreateBk} variant="outline" className="mt-4 gap-2"><Plus className="h-4 w-4" /> New Booking</Button>
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden">
              <div className="max-h-[480px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((bk) => (
                      <TableRow key={bk.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{bk.guestName}</p>
                            {bk.guestPhone && <p className="text-xs text-gray-500">{bk.guestPhone}</p>}
                          </div>
                        </TableCell>
                        <TableCell><span className="text-sm text-gray-700">{bk.service?.name || "—"}</span></TableCell>
                        <TableCell className="text-sm">{bk.date}</TableCell>
                        <TableCell className="text-sm">{bk.time}</TableCell>
                        <TableCell className="text-right text-sm">{bk.quantity}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{formatPrice(bk.totalCost)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PAYMENT_STYLES[bk.paymentStatus] || PAYMENT_STYLES.PENDING}>
                            {bk.paymentStatus}
                            {bk.paymentStatus === "PARTIAL" && <span className="ml-1 text-xs">({formatPrice(bk.paidAmount)})</span>}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditBk(bk)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                              {bk.paymentStatus !== "PAID" && (
                                <DropdownMenuItem onClick={() => openPayDialog(bk)}><CreditCard className="mr-2 h-4 w-4" /> Record Payment</DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => setBkDeleteTarget(bk)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Daytime Room Booking Dialog ─────────────────────────────────────── */}
      <Dialog open={rbDialogOpen} onOpenChange={setRbDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="h-5 w-5 text-emerald-600" />
              Daytime Room Booking
            </DialogTitle>
            <DialogDescription>
              Book a room for a day guest. Price is calculated per hour based on the room&apos;s nightly rate.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Room selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <BedDouble className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-gray-800">Select Room</h3>
              </div>
              {roomsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
              ) : rooms.length === 0 ? (
                <div className="rounded-lg border border-dashed py-4 text-center text-sm text-gray-400">No available rooms</div>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRbForm({ ...rbForm, roomId: r.id })}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                        rbForm.roomId === r.id ? "bg-emerald-50 text-emerald-800" : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <BedDouble className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        Room {r.number}
                        <span className="text-xs text-gray-400 font-normal">— {r.type}</span>
                      </span>
                      <span className={`text-xs font-semibold ${rbForm.roomId === r.id ? "text-emerald-700" : "text-gray-500"}`}>
                        Floor {r.floor}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {rbForm.roomId && selectedRoom && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Room {selectedRoom.number} ({selectedRoom.type}) selected
                </p>
              )}

              {/* Guest info */}
              <div className="flex items-center gap-2 pb-1 border-b pt-2">
                <User className="h-4 w-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-gray-800">Guest Information</h3>
              </div>
              <div className="space-y-2">
                <Label>Guest Name <span className="text-rose-500">*</span></Label>
                <Input placeholder="Full name" value={rbForm.guestName} onChange={(e) => setRbForm({ ...rbForm, guestName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+251 9XX XXX XXX" value={rbForm.guestPhone} onChange={(e) => setRbForm({ ...rbForm, guestPhone: e.target.value })} />
              </div>
            </div>

            {/* Right: Time & summary */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b">
                <Clock className="h-4 w-4 text-sky-500" />
                <h3 className="text-sm font-semibold text-gray-800">Booking Details</h3>
              </div>

              <div className="space-y-2">
                <Label>Date <span className="text-rose-500">*</span></Label>
                <Input type="date" value={rbForm.date} onChange={(e) => setRbForm({ ...rbForm, date: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Check-in Time</Label>
                  <Input type="time" value={rbForm.checkInTime} onChange={(e) => setRbForm({ ...rbForm, checkInTime: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Check-out Time</Label>
                  <Input type="time" value={rbForm.checkOutTime} onChange={(e) => setRbForm({ ...rbForm, checkOutTime: e.target.value })} />
                </div>
              </div>

              {/* Fixed Price */}
              <div className="space-y-2">
                <Label>Price <span className="text-rose-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">ETB</span>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="pl-12"
                    value={rbForm.price}
                    onChange={(e) => setRbForm({ ...rbForm, price: e.target.value })}
                  />
                </div>
                {rbForm.price && Number(rbForm.price) > 0 && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Total: {formatPrice(Number(rbForm.price))}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea placeholder="Any special notes..." rows={3} value={rbForm.notes} onChange={(e) => setRbForm({ ...rbForm, notes: e.target.value })} />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setRbDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveRb}
              disabled={rbSaving || !rbForm.roomId || !rbForm.guestName || !rbForm.date || !rbForm.price || Number(rbForm.price) <= 0}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {rbSaving ? "Booking..." : "Confirm Daytime Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Service Create/Edit Dialog ────────────────────────────────────── */}
      <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSvc ? "Edit Service" : "Add New Service"}</DialogTitle>
            <DialogDescription>{editingSvc ? "Update service details." : "Fill in details to create a new daytime service."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Service Name <span className="text-rose-500">*</span></Label>
              <Input placeholder="e.g. Spa Treatment" value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price <span className="text-rose-500">*</span></Label>
                <Input type="number" placeholder="0" value={svcForm.price} onChange={(e) => setSvcForm({ ...svcForm, price: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="flex flex-wrap gap-1.5">
                  {["SPA", "FOOD", "LAUNDRY", "TOUR", "GYM", "POOL", "EVENT", "OTHER"].map((c) => (
                    <button key={c} type="button" onClick={() => setSvcForm({ ...svcForm, category: c })}
                      className={`rounded px-2 py-1 text-xs font-medium border transition-colors ${svcForm.category === c ? "bg-violet-100 text-violet-800 border-violet-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Input placeholder="e.g. 1 hour, 30 mins" value={svcForm.duration} onChange={(e) => setSvcForm({ ...svcForm, duration: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the service..." rows={3} value={svcForm.description} onChange={(e) => setSvcForm({ ...svcForm, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSvcDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSvc} disabled={svcSaving}>{svcSaving ? "Saving..." : editingSvc ? "Update Service" : "Create Service"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Service Booking Create/Edit Dialog ──────────────────────────────── */}
      <Dialog open={bkDialogOpen} onOpenChange={setBkDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBk ? "Edit Booking" : "New Service Booking"}</DialogTitle>
            <DialogDescription>{editingBk ? "Update booking details." : "Create a new daytime service booking."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Service <span className="text-rose-500">*</span></Label>
              {services.filter(s => s.active && s.category !== "ROOM").length === 0 ? (
                <div className="rounded-lg border border-dashed py-3 text-center text-sm text-gray-400">No active services. Add a service first.</div>
              ) : (
                <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {services.filter(s => s.active && s.category !== "ROOM").map((s) => (
                    <button key={s.id} type="button" onClick={() => setBkForm({ ...bkForm, serviceId: s.id })}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${bkForm.serviceId === s.id ? "bg-violet-50 text-violet-800" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-gray-500">{formatPrice(s.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guest Name <span className="text-rose-500">*</span></Label>
                <Input placeholder="Guest name" value={bkForm.guestName} onChange={(e) => setBkForm({ ...bkForm, guestName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="Phone number" value={bkForm.guestPhone} onChange={(e) => setBkForm({ ...bkForm, guestPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date <span className="text-rose-500">*</span></Label>
                <Input type="date" value={bkForm.date} onChange={(e) => setBkForm({ ...bkForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Time <span className="text-rose-500">*</span></Label>
                <Input type="time" value={bkForm.time} onChange={(e) => setBkForm({ ...bkForm, time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={bkForm.quantity} onChange={(e) => setBkForm({ ...bkForm, quantity: e.target.value })} />
              </div>
            </div>
            {selectedService && !editingBk && (
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <span className="font-medium text-gray-900">Estimated Total: </span>
                {formatPrice(selectedService.price * (Number(bkForm.quantity) || 1))}
                <span className="text-gray-400 ml-1">({formatPrice(selectedService.price)} × {bkForm.quantity || 1})</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveBk} disabled={bkSaving}>{bkSaving ? "Saving..." : editingBk ? "Update Booking" : "Create Booking"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Payment Dialog ────────────────────────────────────────────────── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {payTarget && <span>For {payTarget.guestName}. Balance: <strong>{formatPrice(payTarget.totalCost - payTarget.paidAmount)}</strong></span>}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Amount <span className="text-rose-500">*</span></Label>
              <Input type="number" placeholder="Amount to pay" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="flex gap-2 flex-wrap">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => setPayForm({ ...payForm, method: m })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${payForm.method === m ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={paySaving}>{paySaving ? "Recording..." : "Record Payment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Room Booking Alert ──────────────────────────────────────── */}
      <AlertDialog open={!!rbDeleteTarget} onOpenChange={() => setRbDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking for &quot;{rbDeleteTarget?.guestName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this daytime room booking.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDeleteRb} disabled={rbDeleting}>
              {rbDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Service Alert ──────────────────────────────────────────── */}
      <AlertDialog open={!!svcDeleteTarget} onOpenChange={() => setSvcDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{svcDeleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this service. Services with existing bookings cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDeleteSvc} disabled={svcDeleting}>
              {svcDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Booking Alert ──────────────────────────────────────────── */}
      <AlertDialog open={!!bkDeleteTarget} onOpenChange={() => setBkDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking for &quot;{bkDeleteTarget?.guestName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this booking and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDeleteBk} disabled={bkDeleting}>
              {bkDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}