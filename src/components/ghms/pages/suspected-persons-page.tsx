"use client";

import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useAppStore } from "@/lib/store";
import {
  apiGetSuspectedPersons,
  apiCreateSuspectedPerson,
  apiUpdateSuspectedPerson,
  apiDeleteSuspectedPerson,
} from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  UserX,
  Pencil,
  Trash2,
  Eye,
  Phone,
  Globe,
  MapPin,
  FileWarning,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

interface SuspectedPerson {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  idType: string;
  nationality: string;
  address: string;
  description: string;
  severity: string;
  is_active: boolean;
  registeredBy: string;
  createdAt: string;
  updatedAt: string;
  _count: { matches: number };
}

interface PersonWithHistory extends SuspectedPerson {
  matches?: MatchRecord[];
}

interface MatchRecord {
  id: string;
  matchType: string;
  guestName: string;
  guestPhone: string;
  providerName: string;
  createdAt: string;
  details: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  CRITICAL: "bg-red-100 text-red-800 border-red-200",
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  RESERVATION: "Reservation",
  DAYTIME_BOOKING: "Daytime",
  GUEST_CHECKIN: "Check-in",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const emptyForm = {
  name: "",
  phone: "",
  idNumber: "",
  idType: "",
  nationality: "",
  address: "",
  description: "",
  severity: "MEDIUM",
};

export default function SuspectedPersonsPage() {
  const { refreshKey } = useAppStore();
  const [persons, setPersons] = useState<SuspectedPerson[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPerson, setDetailPerson] = useState<PersonWithHistory | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const pagination = usePagination({ totalItems: persons.length, initialPageSize: 10, pageSizeOptions: [5, 10, 20, 50] });

  // Reset to page 1 when search changes
  useEffect(() => { pagination.resetToFirst(); }, [search]);
  const paginatedPersons = useMemo(() => pagination.paginate(persons), [persons, pagination]);

  const fetchPersons = useCallback(async () => {
    try {
      setLoading(true);
      const query = search ? `q=${encodeURIComponent(search)}` : "";
      const data = await apiGetSuspectedPersons(query);
      setPersons(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load suspected persons";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchPersons(), 300);
    return () => clearTimeout(timer);
  }, [fetchPersons, refreshKey]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (person: SuspectedPerson) => {
    setEditingId(person.id);
    setForm({
      name: person.name,
      phone: person.phone,
      idNumber: person.idNumber,
      idType: person.idType,
      nationality: person.nationality,
      address: person.address,
      description: person.description,
      severity: person.severity,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setFormLoading(true);
    try {
      if (editingId) {
        const updated = await apiUpdateSuspectedPerson(editingId, form);
        setPersons((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, ...updated } : p))
        );
        toast.success("Suspected person updated");
      } else {
        const created = await apiCreateSuspectedPerson(form);
        setPersons((prev) => [created, ...prev]);
        toast.success("Suspected person added");
      }
      setFormOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Operation failed";
      toast.error(message);
    } finally {
      setFormLoading(false);
    }
  };

  const openDetail = async (person: SuspectedPerson) => {
    setDetailPerson(person);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      // Fetch full person with match history
      const res = await fetch(`/api/suspected-persons/${person.id}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setDetailPerson(data);
      }
    } catch {
      // Keep the basic person data
    } finally {
      setDetailLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await apiDeleteSuspectedPerson(deleteId);
      setPersons((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success("Suspected person deleted");
      setDeleteOpen(false);
    } catch (err: unknown) {
      toast.error("Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleActive = async (person: SuspectedPerson) => {
    try {
      const updated = await apiUpdateSuspectedPerson(person.id, { is_active: !person.is_active });
      setPersons((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, is_active: updated.is_active } : p))
      );
      toast.success(updated.is_active ? "Reactivated" : "Deactivated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Suspected Persons</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Register and manage persons of interest
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 sm:h-10"
            />
          </div>
          <Button onClick={openAdd} className="h-9 sm:h-10 shrink-0">
            <Plus className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </div>

      {/* Count */}
      {!loading && persons.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          {persons.length} person{persons.length !== 1 ? "s" : ""} registered
        </p>
      )}

      {/* Pagination Controls */}
      {!loading && persons.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions}
          totalItems={persons.length}
          rangeInfo={pagination.rangeInfo}
          goToPage={pagination.goToPage}
          setPageSize={pagination.setPageSize}
        />
      )}

      {/* List */}
      <div className="rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4 sm:p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full sm:h-12" />
            ))}
          </div>
        ) : persons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <UserX className="mb-3 h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              {search ? "No matches found" : "No suspected persons registered yet"}
            </p>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground/70">
              Add persons to monitor — system will alert when they make reservations
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="divide-y md:hidden">
              {paginatedPersons.map((person) => (
                <div key={person.id} className="p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      !person.is_active ? "bg-slate-100" : person.severity === "CRITICAL" ? "bg-red-100" : person.severity === "HIGH" ? "bg-orange-100" : "bg-yellow-100"
                    }`}>
                      <UserX className={`h-4 w-4 ${
                        !person.is_active ? "text-slate-400" : person.severity === "CRITICAL" ? "text-red-600" : person.severity === "HIGH" ? "text-orange-600" : "text-yellow-600"
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`truncate text-sm font-medium ${!person.is_active ? "text-muted-foreground line-through" : ""}`}>
                          {person.name}
                        </p>
                        <Badge variant="outline" className={`shrink-0 text-[9px] ${SEVERITY_STYLES[person.severity] || ""}`}>
                          {person.severity}
                        </Badge>
                        {!person.is_active && (
                          <Badge variant="outline" className="shrink-0 text-[9px] bg-slate-50 text-slate-400 border-slate-200">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {person.phone && (
                        <p className="text-xs text-muted-foreground font-mono">{person.phone}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {person.idNumber && (
                          <span className="text-[10px] text-muted-foreground">ID: {person.idNumber}</span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                          <ShieldAlert className="h-2.5 w-2.5" />
                          {person._count.matches} match{person._count.matches !== 1 ? "es" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-1.5 pl-12">
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => openDetail(person)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => openEdit(person)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => toggleActive(person)}
                    >
                      {person.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => confirmDelete(person.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>ID Number</TableHead>
                    <TableHead>Nationality</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-center">Matches</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPersons.map((person) => (
                    <TableRow key={person.id} className={!person.is_active ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{person.name}</TableCell>
                      <TableCell className="font-mono text-sm">{person.phone || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{person.idNumber || "—"}</TableCell>
                      <TableCell>{person.nationality || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={SEVERITY_STYLES[person.severity] || ""}>
                          {person.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {person._count.matches > 0 ? (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 text-xs">
                            {person._count.matches}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={person.is_active ? "outline" : "secondary"} className={person.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
                          {person.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(person.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDetail(person)} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(person)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleActive(person)} title={person.is_active ? "Deactivate" : "Activate"}>
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => confirmDelete(person.id)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Suspected Person" : "Register Suspected Person"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update suspect details" : "Add a new person to monitor across all service providers"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="sp-name">Full Name *</Label>
              <Input
                id="sp-name"
                placeholder="Full name of the suspected person"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sp-phone">Phone</Label>
                <Input
                  id="sp-phone"
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sp-severity">Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v }))}>
                  <SelectTrigger id="sp-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sp-idtype">ID Type</Label>
                <Select value={form.idType} onValueChange={(v) => setForm((f) => ({ ...f, idType: v }))}>
                  <SelectTrigger id="sp-idtype">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="National_ID">National ID</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                    <SelectItem value="Driver_License">Driver License</SelectItem>
                    <SelectItem value="Military_ID">Military ID</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sp-idnumber">ID Number</Label>
                <Input
                  id="sp-idnumber"
                  placeholder="ID number"
                  value={form.idNumber}
                  onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sp-nationality">Nationality</Label>
                <Input
                  id="sp-nationality"
                  placeholder="e.g. Ethiopian"
                  value={form.nationality}
                  onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sp-address">Address</Label>
                <Input
                  id="sp-address"
                  placeholder="Last known address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sp-description">Description / Reason</Label>
              <Textarea
                id="sp-description"
                placeholder="Why is this person suspected? Include any relevant details for officers..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formLoading} className="bg-red-600 hover:bg-red-700 text-white">
                {formLoading ? "Saving..." : editingId ? "Update" : "Register Suspect"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail / History Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-600" />
              {detailPerson?.name}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge variant="outline" className={SEVERITY_STYLES[detailPerson?.severity || ""] || ""}>
                {detailPerson?.severity}
              </Badge>
              {!detailPerson?.is_active && (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailPerson && (
            <div className="space-y-4">
              <div className="space-y-3 text-sm">
                {detailPerson.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Phone</p>
                      <p className="font-mono font-medium">{detailPerson.phone}</p>
                    </div>
                  </div>
                )}
                {detailPerson.idNumber && (
                  <div className="flex items-center gap-2.5">
                    <FileWarning className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">{detailPerson.idType || "ID Number"}</p>
                      <p className="font-mono font-medium">{detailPerson.idNumber}</p>
                    </div>
                  </div>
                )}
                {detailPerson.nationality && (
                  <div className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="font-medium">{detailPerson.nationality}</p>
                  </div>
                )}
                {detailPerson.address && (
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="font-medium">{detailPerson.address}</p>
                  </div>
                )}
                {detailPerson.description && (
                  <div className="rounded-lg bg-muted/50 p-3 text-xs">{detailPerson.description}</div>
                )}
              </div>

              <Separator />

              {/* Match History */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Match History ({detailPerson._count?.matches || 0})
                </p>
                {detailLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !detailPerson.matches || detailPerson.matches.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No matches yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {detailPerson.matches.map((match) => (
                      <div key={match.id} className="rounded-lg border p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{match.guestName}</p>
                          <Badge variant="outline" className="text-[9px]">
                            {MATCH_TYPE_LABELS[match.matchType] || match.matchType}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Globe className="h-2.5 w-2.5" /> {match.providerName}
                          </span>
                          {match.guestPhone && <span>{match.guestPhone}</span>}
                          <span>{formatDateTime(match.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              Delete Suspected Person
            </DialogTitle>
            <DialogDescription>
              This will permanently remove this person and all their match history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}