"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetGuests,
  apiCreateGuest,
  apiUpdateGuest,
  apiDeleteGuest,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  Pencil,
  Trash2,
  Star,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Globe,
  FileText,
  Users,
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
  createdAt: string;
  updatedAt: string;
}

const ID_TYPES = ["National ID", "Passport", "Driver's License", "Other"];
const emptyForm = {
  name: "",
  phone: "",
  email: "",
  idNumber: "",
  idType: "National ID",
  nationality: "",
  address: "",
  notes: "",
  vip: false,
};

export default function GuestsPage() {
  const { refreshKey, triggerRefresh } = useAppStore();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchGuests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGetGuests(search);
      setGuests(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load guests";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchGuests(), 300);
    return () => clearTimeout(timer);
  }, [fetchGuests, refreshKey]);

  const openCreate = () => {
    setEditingGuest(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setForm({
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      idNumber: guest.idNumber,
      idType: guest.idType || "National ID",
      nationality: guest.nationality,
      address: guest.address,
      notes: guest.notes,
      vip: guest.vip,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      toast.error("Name and phone are required");
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        idNumber: form.idNumber,
        idType: form.idType,
        nationality: form.nationality,
        address: form.address,
        notes: form.notes,
        vip: form.vip,
      };

      if (editingGuest) {
        await apiUpdateGuest(editingGuest.id, payload);
        toast.success("Guest updated successfully");
      } else {
        await apiCreateGuest(payload);
        toast.success("Guest added successfully");
      }
      setDialogOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save guest";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      setDeleting(true);
      await apiDeleteGuest(deleteDialog.id);
      toast.success("Guest deleted successfully");
      setDeleteDialog(null);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete guest";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "ETB", maximumFractionDigits: 0 }).format(val);

  const filteredGuests = guests.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.phone.toLowerCase().includes(q) ||
      g.idNumber.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.nationality.toLowerCase().includes(q)
    );
  });

  // Desktop table view
  const renderTable = () => (
    <div className="hidden md:block rounded-xl border bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80">
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>ID Number</TableHead>
            <TableHead>Nationality</TableHead>
            <TableHead className="text-center">VIP</TableHead>
            <TableHead className="text-right">Total Spent</TableHead>
            <TableHead className="text-center">Stays</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredGuests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-32 text-center text-gray-400">
                No guests found
              </TableCell>
            </TableRow>
          ) : (
            filteredGuests.map((guest) => (
              <Fragment key={guest.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => toggleExpand(guest.id)}
                >
                  <TableCell>
                    {expandedId === guest.id ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-medium text-sm">
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{guest.name}</span>
                        {guest.vip && (
                          <span className="ml-1.5">
                            <Star className="inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600">{guest.phone}</TableCell>
                  <TableCell className="text-gray-600 text-xs">
                    {guest.idNumber || "—"}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {guest.nationality || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {guest.vip ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                        <Star className="mr-1 h-3 w-3 fill-amber-500 text-amber-500" />
                        VIP
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(guest.totalSpent)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{guest.totalStays}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(guest)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600 focus:text-rose-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialog(guest);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {/* Expanded details row */}
                {expandedId === guest.id && (
                  <TableRow className="bg-gray-50/50">
                    <TableCell colSpan={9}>
                      <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-start gap-2">
                          <Mail className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm text-gray-900">{guest.email || "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CreditCard className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">ID Type / Number</p>
                            <p className="text-sm text-gray-900">
                              {guest.idType} {guest.idNumber ? `· ${guest.idNumber}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Globe className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">Nationality</p>
                            <p className="text-sm text-gray-900">{guest.nationality || "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">Address</p>
                            <p className="text-sm text-gray-900">{guest.address || "—"}</p>
                          </div>
                        </div>
                      </div>
                      {guest.notes && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 border border-amber-100">
                          <FileText className="mt-0.5 h-4 w-4 text-amber-500 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-amber-800">Notes</p>
                            <p className="text-sm text-amber-700">{guest.notes}</p>
                          </div>
                        </div>
                      )}
                      <p className="mt-3 text-xs text-gray-400">
                        Guest since {new Date(guest.createdAt).toLocaleDateString()}
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  // Mobile card view
  const renderCards = () => (
    <div className="space-y-3 md:hidden">
      {filteredGuests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <Users className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-lg font-medium text-gray-500">No guests found</p>
          <p className="mt-1 text-sm text-gray-400">
            {search ? "Try a different search" : "Add your first guest"}
          </p>
        </div>
      ) : (
        filteredGuests.map((guest) => (
          <div
            key={guest.id}
            className="rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-semibold">
                  {guest.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-gray-900">{guest.name}</h3>
                    {guest.vip && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 px-1.5 py-0">
                        <Star className="mr-0.5 h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                        <span className="text-[10px]">VIP</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{guest.phone}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(guest)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600"
                    onClick={() => setDeleteDialog(guest)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">ID</p>
                <p className="text-gray-700 text-xs truncate">{guest.idNumber || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Spent</p>
                <p className="text-gray-700 font-medium">{formatCurrency(guest.totalSpent)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Stays</p>
                <p className="text-gray-700 font-medium">{guest.totalStays}</p>
              </div>
            </div>

            {guest.email && (
              <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" /> {guest.email}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );

  if (loading && guests.length === 0) {
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
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
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
          <h1 className="text-2xl font-bold text-gray-900">Guests</h1>
          <p className="mt-1 text-sm text-gray-500">
            {guests.length} guest{guests.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Guest
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search guests by name, phone, ID, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Content */}
      {renderTable()}
      {renderCards()}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGuest ? "Edit Guest" : "Add New Guest"}</DialogTitle>
            <DialogDescription>
              {editingGuest
                ? "Update guest information below."
                : "Fill in the details to register a new guest."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guest-name">
                  Full Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="guest-name"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-phone">
                  Phone <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="guest-phone"
                  placeholder="+251 9XX XXX XXX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest-email">Email</Label>
              <Input
                id="guest-email"
                type="email"
                placeholder="guest@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guest-id-type">ID Type</Label>
                <Select
                  value={form.idType}
                  onValueChange={(v) => setForm({ ...form, idType: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ID_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-id-number">ID Number</Label>
                <Input
                  id="guest-id-number"
                  placeholder="ID number"
                  value={form.idNumber}
                  onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest-nationality">Nationality</Label>
              <Input
                id="guest-nationality"
                placeholder="e.g. Ethiopian"
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest-address">Address</Label>
              <Input
                id="guest-address"
                placeholder="Full address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guest-notes">Notes</Label>
              <Textarea
                id="guest-notes"
                placeholder="Special requests, preferences..."
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border p-3">
              <Checkbox
                id="guest-vip"
                checked={form.vip}
                onCheckedChange={(checked) => setForm({ ...form, vip: !!checked })}
              />
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <Label htmlFor="guest-vip" className="cursor-pointer font-medium">
                  VIP Guest
                </Label>
              </div>
              <p className="ml-auto text-xs text-gray-400">Priority service & perks</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingGuest ? "Update Guest" : "Add Guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guest?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteDialog?.name}&quot; from your records. This action cannot
              be undone.
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