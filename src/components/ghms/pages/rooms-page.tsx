"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { useAppStore } from "@/lib/store";
import {
  apiGetRooms,
  apiCreateRoom,
  apiUpdateRoom,
  apiDeleteRoom,
  apiUpdateRoomStatus,
  apiImportRooms,
  apiGetReservations,
} from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  ChevronDown,
  Pencil,
  User,
  CalendarDays,
  CreditCard,
  Clock,
  Trash2,
  Users,
  BedSingle,
  BedDouble,
  Hotel,
  Crown,
  Star,
  Building2,
  Layers,
  Wifi,
  Info,
  CalendarPlus,
  CalendarClock,
  LogOut,
  ArrowRightLeft,
  Tv,
  Wind,
  Coffee,
  ShowerHead,
  Car,
  DollarSign,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ClipboardList,
} from "lucide-react";

interface Room {
  id: string;
  number: string;
  name: string;
  type: string;
  pricePerNight: number;
  floor: number;
  capacity: number;
  status: string;
  amenities: string;
  description: string;
  image: string | null;
}

interface ImportResult {
  number: string;
  status: string;
  error?: string;
}

interface RoomReservation {
  id: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomRate: number;
  totalCost: number;
  paymentStatus: string;
  guest: { id: string; name: string; phone: string } | null;
}

const ROOM_TYPES = ["SINGLE", "DOUBLE", "TWIN", "SUITE", "DELUXE"] as const;

const ROOM_TYPE_ICONS: Record<string, React.ReactNode> = {
  SINGLE: <BedSingle className="h-4 w-4" />,
  DOUBLE: <BedDouble className="h-4 w-4" />,
  TWIN: <Hotel className="h-4 w-4" />,
  SUITE: <Crown className="h-4 w-4" />,
  DELUXE: <Star className="h-4 w-4" />,
};

const ROOM_TYPE_COLORS: Record<string, string> = {
  SINGLE: "bg-sky-50 text-sky-700 border-sky-200",
  DOUBLE: "bg-violet-50 text-violet-700 border-violet-200",
  TWIN: "bg-teal-50 text-teal-700 border-teal-200",
  SUITE: "bg-amber-50 text-amber-700 border-amber-200",
  DELUXE: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OCCUPIED: "bg-rose-100 text-rose-800 border-rose-200",
  MAINTENANCE: "bg-amber-100 text-amber-800 border-amber-200",
  RESERVED: "bg-sky-100 text-sky-800 border-sky-200",
};

const STATUS_DOT: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  OCCUPIED: "bg-rose-500",
  MAINTENANCE: "bg-amber-500",
  RESERVED: "bg-sky-500",
};

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  WiFi: <Wifi className="h-3 w-3" />,
  TV: <Tv className="h-3 w-3" />,
  AC: <Wind className="h-3 w-3" />,
  "Mini Bar": <Coffee className="h-3 w-3" />,
  "Hot Water": <ShowerHead className="h-3 w-3" />,
  Parking: <Car className="h-3 w-3" />,
};

// Derive floor from first digit of room number (e.g. "102" → 1, "201" → 2)
const getFloorFromNumber = (num: string): number | null => {
  const match = num.match(/^\d/);
  return match ? parseInt(match[0], 10) : null;
};

const emptyForm = {
  number: "",
  type: "SINGLE",
  pricePerNight: "",
  floor: "",
  capacity: "",
  amenities: "[]",
  description: "",
};

// ── Excel template columns ───────────────────────────────────────────────────
const TEMPLATE_COLUMNS = ["number", "type", "pricePerNight", "floor", "capacity", "amenities", "description"];
const TEMPLATE_EXAMPLE = [
  { number: "101", type: "SINGLE", pricePerNight: 500, floor: 1, capacity: 1, amenities: "WiFi, TV", description: "Standard single room" },
  { number: "102", type: "DOUBLE", pricePerNight: 900, floor: 1, capacity: 2, amenities: "WiFi, TV, AC", description: "Comfortable double room" },
  { number: "201", type: "SUITE",  pricePerNight: 1800, floor: 2, capacity: 3, amenities: "WiFi, TV, AC, Mini Bar", description: "Luxury suite" },
];

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_EXAMPLE, { header: TEMPLATE_COLUMNS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rooms");
  XLSX.writeFile(wb, "rooms_import_template.xlsx");
}

export default function RoomsPage() {
  const { refreshKey, triggerRefresh, setCurrentPage, setPreselectedRoom } = useAppStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // single-room dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // delete
  const [deleteDialog, setDeleteDialog] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState(false);

  // room info detail
  const [infoRoom, setInfoRoom] = useState<Room | null>(null);
  const [roomReservations, setRoomReservations] = useState<RoomReservation[]>([]);
  const [roomResLoading, setRoomResLoading] = useState(false);

  // excel import
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGetRooms(search);
      const list = data.rooms || [];
      // Sort: AVAILABLE first, then RESERVED, then others; within each group by floor
      const statusOrder: Record<string, number> = { AVAILABLE: 0, RESERVED: 1, OCCUPIED: 2, MAINTENANCE: 3 };
      list.sort((a, b) => {
        const oa = statusOrder[a.status] ?? 9;
        const ob = statusOrder[b.status] ?? 9;
        if (oa !== ob) return oa - ob;
        const fa = getFloorFromNumber(a.number) ?? a.floor ?? 0;
        const fb = getFloorFromNumber(b.number) ?? b.floor ?? 0;
        return fa - fb;
      });
      setRooms(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load rooms";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchRooms(), 300);
    return () => clearTimeout(timer);
  }, [fetchRooms, refreshKey]);

  // Fetch reservations for the room when info dialog opens
  useEffect(() => {
    if (!infoRoom) {
      setRoomReservations([]);
      return;
    }
    (async () => {
      try {
        setRoomResLoading(true);
        const data = await apiGetReservations(`roomId=${infoRoom.id}`);
        setRoomReservations(Array.isArray(data) ? data : []);
      } catch {
        setRoomReservations([]);
      } finally {
        setRoomResLoading(false);
      }
    })();
  }, [infoRoom]);

  const openCreate = () => {
    setEditingRoom(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setForm({
      number: room.number,
      type: room.type,
      pricePerNight: String(room.pricePerNight),
      floor: String(room.floor),
      capacity: String(room.capacity),
      amenities: room.amenities,
      description: room.description,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.number || !form.pricePerNight || !form.floor || !form.capacity) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        number: form.number,
        type: form.type,
        pricePerNight: Number(form.pricePerNight),
        floor: Number(form.floor),
        capacity: Number(form.capacity),
        amenities: form.amenities || "[]",
        description: form.description,
      };

      if (editingRoom) {
        await apiUpdateRoom(editingRoom.id, payload);
        toast.success("Room updated successfully");
      } else {
        await apiCreateRoom(payload);
        toast.success("Room created successfully");
      }

      setDialogOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save room";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      setDeleting(true);
      await apiDeleteRoom(deleteDialog.id);
      toast.success("Room deleted successfully");
      setDeleteDialog(null);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete room";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (room: Room, newStatus: string) => {
    try {
      await apiUpdateRoomStatus(room.id, newStatus);
      toast.success(`Room ${room.number} status changed to ${newStatus}`);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      toast.error(message);
    }
  };

  const handleReserveFromRoom = (room: Room) => {
    setInfoRoom(null);
    setPreselectedRoom({
      id: room.id,
      number: room.number,
      name: room.name,
      type: room.type,
      pricePerNight: room.pricePerNight,
    });
    setCurrentPage("reservations");
  };

  // ── Excel import ────────────────────────────────────────────────────────────
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportFile(e.target.files?.[0] ?? null);
    setImportResults(null);
  };

  const handleImport = async () => {
    if (!importFile) { toast.error("Please select an Excel file first"); return; }
    setImportLoading(true);
    try {
      const buffer = await importFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (rows.length === 0) { toast.error("No data rows found in the file"); return; }

      const result = await apiImportRooms(rows as Record<string, unknown>[]);
      setImportResults(result.results);
      toast.success(`Import complete: ${result.imported} created, ${result.skipped} skipped`);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error(message);
    } finally {
      setImportLoading(false);
    }
  };

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setImportFile(null);
    setImportResults(null);
    if (importFileRef.current) importFileRef.current.value = "";
  };

  const parseAmenities = (amenitiesStr: string): string[] => {
    try {
      const parsed = JSON.parse(amenitiesStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return amenitiesStr.split(",").map((s) => s.trim()).filter(Boolean);
    }
  };

  const floors = useMemo(() => {
    const set = new Set<number>();
    rooms.forEach((r) => {
      const f = getFloorFromNumber(r.number);
      if (f !== null) set.add(f);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  const filteredRooms = rooms.filter((room) => {
    if (statusFilter && room.status !== statusFilter) return false;
    if (floorFilter !== null && getFloorFromNumber(room.number) !== floorFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      room.number.toLowerCase().includes(q) ||
      room.name.toLowerCase().includes(q) ||
      room.type.toLowerCase().includes(q)
    );
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(price);

  if (loading && rooms.length === 0) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
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
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your {rooms.length} room{rooms.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Import Excel
          </Button>
          <Button variant="outline" onClick={() => setCurrentPage("reservations")} className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Reservations
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search rooms by number, name, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Floor & Status Filter Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Floor:</span>
        <div className="flex gap-1.5">
          <Button
            variant={floorFilter === null && statusFilter === null ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs px-3 shrink-0"
            onClick={() => { setFloorFilter(null); setStatusFilter(null); }}
          >
            All
          </Button>
          {floors.slice(0, 3).map((f) => (
            <Button
              key={f}
              variant={floorFilter === f ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs px-3 shrink-0"
              onClick={() => setFloorFilter(floorFilter === f ? null : f)}
            >
              <Building2 className="h-3.5 w-3.5 mr-1" />
              {f}
            </Button>
          ))}
          {floors.length > 3 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={floorFilter !== null && floors.slice(3).includes(floorFilter) ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs px-3 shrink-0 gap-1"
                >
                  Others
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {floors.slice(3).map((f) => (
                  <DropdownMenuItem
                    key={f}
                    className="text-xs"
                    onClick={() => setFloorFilter(f)}
                  >
                    <Building2 className="h-3.5 w-3.5 mr-2" />
                    Floor {f}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Status:</span>
        <div className="flex gap-1.5">
          <Button
            variant={statusFilter === "AVAILABLE" ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs px-3 shrink-0"
            onClick={() => setStatusFilter(statusFilter === "AVAILABLE" ? null : "AVAILABLE")}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Available
          </Button>
          <Button
            variant={statusFilter === "OCCUPIED" ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs px-3 shrink-0"
            onClick={() => setStatusFilter(statusFilter === "OCCUPIED" ? null : "OCCUPIED")}
          >
            <AlertCircle className="h-3.5 w-3.5 mr-1" />
            Occupied
          </Button>
        </div>
      </div>
      {/* Room Grid */}
      {filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Building2 className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-lg font-medium text-gray-500">No rooms found</p>
          <p className="mt-1 text-sm text-gray-400">
            {search ? "Try a different search term" : "Get started by adding your first room"}
          </p>
          {!search && (
            <div className="mt-4 flex gap-2">
              <Button onClick={openCreate} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Room
              </Button>
              <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Import Excel
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRooms.map((room) => {
            const amenities = parseAmenities(room.amenities);
            return (
              <Card key={room.id} className="gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
                {/* Status Bar */}
                <div className={`h-1.5 w-full ${STATUS_DOT[room.status]}`} />

                <CardContent className="p-4">
                  {/* Room Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ROOM_TYPE_COLORS[room.type]}`}>
                        {ROOM_TYPE_ICONS[room.type]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 leading-tight">
                          Room {room.number}
                        </h3>
                        <p className="text-sm text-gray-500">{room.type}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {room.status === "OCCUPIED" ? (
                          <>
                            <DropdownMenuItem onClick={() => {
                              setPreselectedRoom({ id: room.id, number: room.number, name: room.name, type: room.type, pricePerNight: room.pricePerNight });
                              setCurrentPage("reservations");
                            }}>
                              <CalendarClock className="mr-2 h-4 w-4" />
                              Extend Stay / Early Checkout
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setPreselectedRoom({ id: room.id, number: room.number, name: room.name, type: room.type, pricePerNight: room.pricePerNight });
                              setCurrentPage("reservations");
                            }}>
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Room Shift
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem onClick={() => openEdit(room)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {room.status !== "OCCUPIED" && (
                          <DropdownMenuItem
                            onClick={() => {
                              const nextStatus = room.status === "AVAILABLE" ? "MAINTENANCE" : "AVAILABLE";
                              handleStatusChange(room, nextStatus);
                            }}
                          >
                            <Layers className="mr-2 h-4 w-4" />
                            Toggle Availability
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-600"
                          onClick={() => setDeleteDialog(room)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <Badge variant="outline" className={ROOM_TYPE_COLORS[room.type]}>
                      {room.type}
                    </Badge>
                    <Badge variant="outline" className={STATUS_STYLES[room.status]}>
                      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[room.status]}`} />
                      {room.status}
                    </Badge>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                      <span>{formatPrice(room.pricePerNight)}</span>
                      <span className="text-gray-400">/night</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      <span>{room.capacity} guest{room.capacity !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      <span>Floor {getFloorFromNumber(room.number) ?? room.floor}</span>
                    </div>
                  </div>

                  {/* Amenities */}
                  {amenities.length > 0 && (
                    <>
                      <Separator className="my-3" />
                      <div className="flex flex-wrap gap-2">
                        {amenities.slice(0, 5).map((amenity) => (
                          <div
                            key={amenity}
                            className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600 border border-gray-100"
                          >
                            {AMENITY_ICONS[amenity] || <Layers className="h-3 w-3" />}
                            {amenity}
                          </div>
                        ))}
                        {amenities.length > 5 && (
                          <span className="flex items-center px-2 py-1 text-xs text-gray-400">
                            +{amenities.length - 5} more
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Action Buttons */}
                  <Separator className="my-3" />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => setInfoRoom(room)}
                    >
                      <Info className="h-3.5 w-3.5" />
                      Info
                    </Button>
                    {room.status === "AVAILABLE" ? (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleReserveFromRoom(room)}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Reserve
                      </Button>
                    ) : room.status === "RESERVED" ? (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 text-xs bg-sky-600 hover:bg-sky-700"
                        onClick={() => { setPreselectedRoom({ id: room.id, number: room.number, name: room.name, type: room.type, pricePerNight: room.pricePerNight }); setCurrentPage("reservations"); }}
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        Manage Reservations
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 text-xs"
                        disabled
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Reserve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog — no Room Name field */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Edit Room" : "Add New Room"}</DialogTitle>
            <DialogDescription>
              {editingRoom
                ? "Update room details below."
                : "Fill in the details to create a new room."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room-number">
                  Room Number <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="room-number"
                  placeholder="e.g. 101"
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-type">Room Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        <span className="flex items-center gap-2">
                          {ROOM_TYPE_ICONS[type]}
                          {type}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room-price">
                  Price/Night <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="room-price"
                  type="number"
                  placeholder="0"
                  value={form.pricePerNight}
                  onChange={(e) => setForm({ ...form, pricePerNight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-floor">
                  Floor <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="room-floor"
                  type="number"
                  placeholder="1"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-capacity">
                  Capacity <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="room-capacity"
                  type="number"
                  placeholder="2"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-amenities">Amenities (comma-separated)</Label>
              <Input
                id="room-amenities"
                placeholder="WiFi, TV, AC, Mini Bar, Hot Water"
                value={
                  (() => {
                    try {
                      const parsed = JSON.parse(form.amenities);
                      return Array.isArray(parsed) ? parsed.join(", ") : form.amenities;
                    } catch {
                      return form.amenities;
                    }
                  })()
                }
                onChange={(e) =>
                  setForm({
                    ...form,
                    amenities: JSON.stringify(
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                    ),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-description">Description</Label>
              <Textarea
                id="room-description"
                placeholder="Describe the room..."
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingRoom ? "Update Room" : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={closeImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Import Rooms from Excel
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xlsx / .xls) with room data. Download the
              template below for the correct column format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template download */}
            <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800 mb-1">Required columns:</p>
              <p className="text-xs text-emerald-700 mb-3 font-mono">
                number · type · pricePerNight · floor · capacity · amenities · description
              </p>
              <p className="text-xs text-emerald-600 mb-3">
                <strong>type</strong> must be one of: SINGLE, DOUBLE, TWIN, SUITE, DELUXE<br />
                <strong>amenities</strong> — comma-separated, e.g. <em>WiFi, TV, AC</em>
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 border-emerald-400 text-emerald-700 hover:bg-emerald-100">
                <Download className="h-3.5 w-3.5" />
                Download Template
              </Button>
            </div>

            {/* File picker */}
            <div className="space-y-2">
              <Label htmlFor="excel-file">Select Excel File</Label>
              <div className="flex gap-2">
                <Input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  ref={importFileRef}
                  onChange={handleImportFileChange}
                  className="flex-1"
                />
              </div>
              {importFile && (
                <p className="text-xs text-gray-500">
                  Selected: <strong>{importFile.name}</strong> ({(importFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* Import results */}
            {importResults && (
              <div className="rounded-lg border bg-gray-50 p-3 max-h-48 overflow-y-auto space-y-1">
                <p className="text-xs font-semibold text-gray-600 mb-2">Import Results:</p>
                {importResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.status === "created" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : r.status === "skipped" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className="font-medium">Room {r.number}</span>
                    <span className={r.status === "created" ? "text-emerald-600" : "text-amber-600"}>
                      {r.status === "created" ? "Created" : r.error}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeImportDialog}>
              {importResults ? "Close" : "Cancel"}
            </Button>
            {!importResults && (
              <Button onClick={handleImport} disabled={importLoading || !importFile} className="gap-2">
                <Upload className="h-4 w-4" />
                {importLoading ? "Importing..." : "Import Rooms"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room {deleteDialog?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete room &quot;{deleteDialog?.name}&quot; and all
              associated data.
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

      {/* Room Info Detail Modal */}
      <Dialog open={!!infoRoom} onOpenChange={(open) => { if (!open) setInfoRoom(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {infoRoom && (() => {
            const amenities = parseAmenities(infoRoom.amenities);
            const activeRes = roomReservations.find((r) => r.status === "ACTIVE" || r.status === "CHECKED_IN");
            const upcomingRes = roomReservations.filter((r) => r.status === "UPCOMING");
            const pastRes = roomReservations.filter((r) => r.status === "COMPLETED" || r.status === "CANCELLED" || r.status === "CHECKED_OUT");

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ROOM_TYPE_COLORS[infoRoom.type]}`}>
                      {ROOM_TYPE_ICONS[infoRoom.type]}
                    </div>
                    Room {infoRoom.number}
                    <Badge variant="outline" className={STATUS_STYLES[infoRoom.status]}>
                      <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[infoRoom.status]}`} />
                      {infoRoom.status}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription>{infoRoom.name}</DialogDescription>
                </DialogHeader>

                {/* Room Image */}
                {infoRoom.image && (
                  <div className="rounded-lg overflow-hidden border">
                    <img
                      src={infoRoom.image}
                      alt={`Room ${infoRoom.number}`}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                {/* Description */}
                {infoRoom.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{infoRoom.description}</p>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-gray-500 mb-1">Room Type</p>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                      {ROOM_TYPE_ICONS[infoRoom.type]} {infoRoom.type}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-gray-500 mb-1">Price per Night</p>
                    <p className="text-sm font-semibold text-gray-900">{formatPrice(infoRoom.pricePerNight)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-gray-500 mb-1">Capacity</p>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-gray-400" /> {infoRoom.capacity} guest{infoRoom.capacity !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-gray-500 mb-1">Floor</p>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-gray-400" /> Floor {infoRoom.floor}
                    </p>
                  </div>
                </div>

                {/* Amenities */}
                {amenities.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-2">
                      {amenities.map((amenity) => (
                        <div
                          key={amenity}
                          className="flex items-center gap-1.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-gray-700 border border-gray-200"
                        >
                          {AMENITY_ICONS[amenity] || <Layers className="h-3.5 w-3.5" />}
                          {amenity}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Guest & Reservation Info */}
                <Separator />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> Reservations & Guest
                  </p>

                  {roomResLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                      <Clock className="h-4 w-4 animate-spin" /> Loading reservations...
                    </div>
                  ) : roomReservations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                      <p className="text-sm text-gray-400">No reservations found for this room</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Current / Active Reservation */}
                      {activeRes && (
                        <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge className="bg-emerald-600 text-white text-xs">Current Guest</Badge>
                            <span className="text-xs text-emerald-600 font-medium">Active</span>
                          </div>
                          {activeRes.guest && (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                                <User className="h-4 w-4 text-emerald-700" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{activeRes.guest.name}</p>
                                <p className="text-xs text-gray-500">{activeRes.guest.phone}</p>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 text-gray-400" />
                              {activeRes.checkIn} → {activeRes.checkOut}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              {activeRes.nights} night{activeRes.nights !== 1 ? "s" : ""}
                            </div>
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-3 w-3 text-gray-400" />
                              {activeRes.paymentStatus}
                            </div>
                            <div className="flex items-center gap-1 font-medium text-gray-900">
                              {formatPrice(activeRes.totalCost)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Upcoming Reservations */}
                      {upcomingRes.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-sky-700 mb-1.5">Upcoming</p>
                          <div className="space-y-2">
                            {upcomingRes.slice(0, 3).map((res) => (
                              <div key={res.id} className="rounded-lg border border-sky-200 bg-sky-50 p-2.5">
                                <div className="flex items-center justify-between mb-1">
                                  {res.guest && (
                                    <div className="flex items-center gap-1.5">
                                      <User className="h-3.5 w-3.5 text-sky-600" />
                                      <span className="text-sm font-medium text-gray-900">{res.guest.name}</span>
                                    </div>
                                  )}
                                  <Badge variant="outline" className="text-xs border-sky-300 text-sky-700">{res.paymentStatus}</Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <CalendarDays className="h-3 w-3" /> {res.checkIn} → {res.checkOut}
                                  </span>
                                  <span>{res.nights} night{res.nights !== 1 ? "s" : ""}</span>
                                  <span className="font-medium text-gray-700">{formatPrice(res.totalCost)}</span>
                                </div>
                              </div>
                            ))}
                            {upcomingRes.length > 3 && (
                              <p className="text-xs text-gray-400 text-center">+{upcomingRes.length - 3} more upcoming</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Past Reservations count */}
                      {pastRes.length > 0 && (
                        <p className="text-xs text-gray-400 text-center">
                          {pastRes.length} past reservation{pastRes.length !== 1 ? "s" : ""} for this room
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setInfoRoom(null)}>
                    Close
                  </Button>
                  {infoRoom.status === "AVAILABLE" ? (
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleReserveFromRoom(infoRoom)}
                    >
                      <CalendarPlus className="h-4 w-4" />
                      Reserve This Room
                    </Button>
                  ) : infoRoom.status === "RESERVED" ? (
                    <Button
                      className="gap-2 bg-sky-600 hover:bg-sky-700"
                      onClick={() => { setPreselectedRoom({ id: infoRoom.id, number: infoRoom.number, name: infoRoom.name, type: infoRoom.type, pricePerNight: infoRoom.pricePerNight }); setInfoRoom(null); setCurrentPage("reservations"); }}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Manage Reservations
                    </Button>
                  ) : infoRoom.status === "OCCUPIED" ? (
                    <div className="flex gap-2">
                      <Button
                        className="gap-2 bg-amber-600 hover:bg-amber-700"
                        onClick={() => { setPreselectedRoom({ id: infoRoom.id, number: infoRoom.number, name: infoRoom.name, type: infoRoom.type, pricePerNight: infoRoom.pricePerNight }); setInfoRoom(null); setCurrentPage("reservations"); }}
                      >
                        <CalendarClock className="h-4 w-4" />
                        Extend / Early Out
                      </Button>
                      <Button
                        className="gap-2 bg-violet-600 hover:bg-violet-700"
                        onClick={() => { setPreselectedRoom({ id: infoRoom.id, number: infoRoom.number, name: infoRoom.name, type: infoRoom.type, pricePerNight: infoRoom.pricePerNight }); setInfoRoom(null); setCurrentPage("reservations"); }}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Room Shift
                      </Button>
                    </div>
                  ) : null}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}