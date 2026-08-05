"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useAppStore } from "@/lib/store";
import { req, apiGetProviders, apiUpdateProvider, apiGeocodeAddress, apiGeocodeBatch, apiPoliceSuspendProvider, apiSuperCreateProvider } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  Building2,
  CheckCircle2,
  XCircle,
  Ban,
  Eye,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  ShieldCheck,
  User,
  Globe,
  MapPinned,
  RefreshCw,
  Crosshair,
  Send,
  AlertTriangle,
  Loader2,
  UserPlus,
  KeyRound,
  Upload,
  X,
  RotateCcw,
} from "lucide-react";
import dynamic from "next/dynamic";

const CoordinatePicker = dynamic(() => import("@/components/shared/coordinate-picker"), {
  ssr: false,
  loading: () => <Skeleton className="h-[250px] w-full rounded-lg" />,
});

interface Provider {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  type: string;
  licenseNo: string;
  licenseFile: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
  suspensionReason?: string;
  suspendedAt?: string | null;
  suspendedBy?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  APPROVED: { label: "Approved", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  SUSPENDED: { label: "Suspended", variant: "outline" },
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200",
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  REJECTED: "bg-red-100 text-red-800 hover:bg-red-100 border-red-200",
  SUSPENDED: "bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, variant: "secondary" as const };
  return (
    <Badge variant={cfg.variant} className={STATUS_BADGE_CLASS[status] || ""}>
      {cfg.label}
    </Badge>
  );
}

const GUESTHOUSE_TYPES = [
  { value: "GUEST_HOUSE", label: "Guest House" },
  { value: "HOTEL", label: "Hotel" },
  { value: "HOSTEL", label: "Hostel" },
  { value: "LODGE", label: "Lodge" },
  { value: "RESORT", label: "Resort" },
];

interface RegisterForm {
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  type: string;
  licenseNo: string;
  licenseFileData: string;
  licenseFileName: string;
  username: string;
  password: string;
}

const emptyRegisterForm: RegisterForm = {
  name: "",
  ownerName: "",
  phone: "",
  email: "",
  address: "",
  type: "GUEST_HOUSE",
  licenseNo: "",
  licenseFileData: "",
  licenseFileName: "",
  username: "",
  password: "",
};

export default function ProvidersPage() {
  const { refreshKey, triggerRefresh, currentUser } = useAppStore();
  const isSuperuser = currentUser?.role === "SUPERUSER";
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Registration form
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState<RegisterForm>(emptyRegisterForm);
  const [registering, setRegistering] = useState(false);

  // Coordinate editing
  const [coordProvider, setCoordProvider] = useState<Provider | null>(null);
  const [coordOpen, setCoordOpen] = useState(false);
  const [editLat, setEditLat] = useState(9.02);
  const [editLng, setEditLng] = useState(38.75);
  const [savingCoord, setSavingCoord] = useState(false);
  const [geocodingOne, setGeocodingOne] = useState(false);

  // Batch geocode
  const [geocodingAll, setGeocodingAll] = useState(false);
  const [batchResult, setBatchResult] = useState<{ updated: number; failed: number; total: number; results?: any[] } | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  // Action dialogs
  const [rejectDialog, setRejectDialog] = useState<Provider | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ provider: Provider; action: string } | null>(null);
  const [actioning, setActioning] = useState(false);

  // Suspension dialog (with reason + notification)
  const [suspendDialog, setSuspendDialog] = useState<Provider | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [providerMessage, setProviderMessage] = useState("");
  const [suspending, setSuspending] = useState(false);

  const pagination = usePagination({ totalItems: providers.length, initialPageSize: 5, pageSizeOptions: [5, 10, 20, 50] });
  const paginatedProviders = useMemo(() => pagination.paginate(providers), [providers, pagination]);

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGetProviders();
      setProviders(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load providers";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders, refreshKey]);

  const openDetail = (provider: Provider) => {
    setSelectedProvider(provider);
    setDetailOpen(true);
  };

  const openReject = (provider: Provider) => {
    setRejectDialog(provider);
    setRejectReason("");
  };

  const openCoordPicker = (provider: Provider) => {
    setCoordProvider(provider);
    setEditLat(provider.latitude || 9.02);
    setEditLng(provider.longitude || 38.75);
    setCoordOpen(true);
  };

  const geocodeSingle = async () => {
    if (!coordProvider || !coordProvider.address) {
      toast.error("Provider has no address to geocode");
      return;
    }
    try {
      setGeocodingOne(true);
      const result: any = await apiGeocodeAddress(coordProvider.address);
      if (result.lat && result.lng) {
        setEditLat(result.lat);
        setEditLng(result.lng);
        toast.success(`Found: ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
      } else {
        toast.error("Could not find coordinates for this address");
      }
    } catch {
      toast.error("Geocoding failed");
    } finally {
      setGeocodingOne(false);
    }
  };

  const saveCoordinates = async () => {
    if (!coordProvider) return;
    try {
      setSavingCoord(true);
      await apiUpdateProvider(coordProvider.id, { status: coordProvider.status, latitude: editLat, longitude: editLng });
      toast.success("Coordinates updated");
      setCoordOpen(false);
      triggerRefresh();
    } catch {
      toast.error("Failed to save coordinates");
    } finally {
      setSavingCoord(false);
    }
  };

  const batchGeocode = async () => {
    try {
      setGeocodingAll(true);
      const result: any = await apiGeocodeBatch();
      setBatchResult(result);
      toast.success(result.message || `Geocoded ${result.updated} providers`);
      triggerRefresh();
    } catch {
      toast.error("Batch geocoding failed");
    } finally {
      setGeocodingAll(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog || !rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      setActioning(true);
      await apiUpdateProvider(rejectDialog.id, { status: "REJECTED", rejectionReason: rejectReason.trim() });
      toast.success("Provider rejected");
      setRejectDialog(null);
      setRejectReason("");
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject provider";
      toast.error(message);
    } finally {
      setActioning(false);
    }
  };

  const handleStatusAction = async (provider: Provider, status: string) => {
    try {
      setActioning(true);
      if (status === "REACTIVATE") {
        await req(`/api/providers/${provider.id}/reactivate`, { method: "POST" });
        toast.success(`"${provider.name}" has been reactivated and is fully active`);
      } else {
        await apiUpdateProvider(provider.id, { status });
        toast.success(`Provider ${status.toLowerCase()}`);
      }
      setConfirmAction(null);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update provider";
      toast.error(message);
    } finally {
      setActioning(false);
    }
  };

  const openSuspend = (provider: Provider) => {
    setSuspendDialog(provider);
    setSuspensionReason("");
    setProviderMessage("");
  };

  const handleRegister = async () => {
    if (!registerForm.name.trim() || !registerForm.ownerName.trim() || !registerForm.phone.trim()) {
      toast.error("Guesthouse name, owner name, and phone are required");
      return;
    }
    if (!registerForm.username.trim() || !registerForm.password.trim()) {
      toast.error("Operator username and password are required");
      return;
    }
    if (registerForm.password.trim().length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    try {
      setRegistering(true);
      await apiSuperCreateProvider({
        ...registerForm,
        licenseFile: registerForm.licenseFileData || undefined,
      });
      toast.success(`"${registerForm.name}" registered and approved successfully`);
      setRegisterOpen(false);
      setRegisterForm(emptyRegisterForm);
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to register guesthouse");
    } finally {
      setRegistering(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendDialog) return;
    if (!suspensionReason.trim()) {
      toast.error("Please provide a reason for suspension");
      return;
    }
    try {
      setSuspending(true);
      await apiPoliceSuspendProvider({
        providerId: suspendDialog.id,
        suspensionReason: suspensionReason.trim(),
        providerMessage: providerMessage.trim() || undefined,
      });
      toast.success(`"${suspendDialog.name}" has been suspended. Notification sent to provider.`);
      setSuspendDialog(null);
      setSuspensionReason("");
      setProviderMessage("");
      triggerRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to suspend provider");
    } finally {
      setSuspending(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const approvedCount = providers.filter((p) => p.status === "APPROVED").length;
  const pendingCount = providers.filter((p) => p.status === "PENDING").length;
  const withCoords = providers.filter(
    (p) => p.latitude !== 9.02 || p.longitude !== 38.75,
  ).length;

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-slate-100">
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">Total</p>
              <p className="text-lg sm:text-2xl font-bold">{providers.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">Approved</p>
              <p className="text-lg sm:text-2xl font-bold text-emerald-600">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-yellow-50">
              <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">Pending</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-blue-50">
              <MapPinned className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">With Coords</p>
              <p className="text-lg sm:text-2xl font-bold text-blue-600">{withCoords}/{providers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Geocode All Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">
            {isSuperuser ? "Guesthouses" : "Provider Applications"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isSuperuser
              ? "Register new guesthouses and manage existing ones."
              : "Manage registrations, licensing, and map locations"}
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperuser && (
            <Button size="sm" className="gap-1.5" onClick={() => setRegisterOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" /> Register Guesthouse
            </Button>
          )}
          {!isSuperuser && (
            <Button variant="outline" size="sm" onClick={() => setBatchOpen(true)} disabled={geocodingAll}>
              <Globe className={`mr-1 h-3.5 w-3.5 ${geocodingAll ? "animate-spin" : ""}`} />
              {geocodingAll ? "Geocoding..." : "Geocode All"}
            </Button>
          )}
        </div>
      </div>

      {/* Providers Table/Cards */}
      <div className="rounded-xl border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4 sm:p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full sm:h-12" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
            <Building2 className="mb-3 h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40" />
            <p className="text-xs sm:text-sm text-muted-foreground">No providers registered yet</p>
          </div>
        ) : (
          <>
            {/* Mobile/Tablet: Card layout */}
            <div className="divide-y lg:hidden">
              {paginatedProviders.map((provider) => (
                <div key={provider.id} className={`p-3 sm:p-4 ${provider.status === "SUSPENDED" ? "bg-orange-50/60" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => openDetail(provider)}>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{provider.name}</p>
                        <StatusBadge status={provider.status} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {provider.ownerName}</span>
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {provider.phone}</span>
                      </div>
                      {provider.address && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {provider.address}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">{provider.type.replace(/_/g, " ")}</span>
                        {(provider.latitude !== 9.02 || provider.longitude !== 38.75) ? (
                          <span className="flex items-center gap-0.5 text-emerald-600"><Crosshair className="h-2.5 w-2.5" /> {provider.latitude.toFixed(4)}, {provider.longitude.toFixed(4)}</span>
                        ) : (
                          <span className="text-muted-foreground">No coordinates</span>
                        )}
                      </div>
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5 flex-wrap">
                    <button className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100" onClick={() => openDetail(provider)}>
                      <Eye className="h-3.5 w-3.5" /> Details
                    </button>
                    {!isSuperuser && (
                      <button className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50" onClick={() => openCoordPicker(provider)}>
                        <MapPinned className="h-3.5 w-3.5" /> Set Location
                      </button>
                    )}
                    {provider.status !== "APPROVED" && provider.status !== "SUSPENDED" && (
                      <button className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50" onClick={() => setConfirmAction({ provider, action: "APPROVED" })}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {provider.status === "SUSPENDED" && (
                      <button className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50" onClick={() => setConfirmAction({ provider, action: "REACTIVATE" })}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                      </button>
                    )}
                    {provider.status !== "REJECTED" && provider.status !== "APPROVED" && provider.status !== "SUSPENDED" && (
                      <button className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50" onClick={() => openReject(provider)}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    )}
                    {provider.status === "APPROVED" && (
                      <button className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50" onClick={() => openSuspend(provider)}>
                        <Ban className="h-3.5 w-3.5" /> Suspend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProviders.map((provider) => (
                    <TableRow key={provider.id} className={`cursor-pointer hover:bg-muted/50 ${provider.status === "SUSPENDED" ? "bg-orange-50/70 hover:bg-orange-100/60" : ""}`} onClick={() => openDetail(provider)}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">{provider.address || "—"}</TableCell>
                      <TableCell>{provider.ownerName}</TableCell>
                      <TableCell>{provider.phone}</TableCell>
                      <TableCell>
                        {(provider.latitude !== 9.02 || provider.longitude !== 38.75) ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600">
                            <Crosshair className="h-3 w-3" /> {provider.latitude.toFixed(4)}, {provider.longitude.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={provider.status} /></TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {provider.status !== "APPROVED" && provider.status !== "SUSPENDED" && (
                            <Button size="sm" variant="ghost" className="h-8 text-emerald-600 hover:bg-emerald-50" onClick={() => setConfirmAction({ provider, action: "APPROVED" })}>
                              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                            </Button>
                          )}
                          {provider.status !== "REJECTED" && provider.status !== "APPROVED" && provider.status !== "SUSPENDED" && (
                            <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:bg-red-50" onClick={() => openReject(provider)}>
                              <XCircle className="mr-1 h-4 w-4" /> Reject
                            </Button>
                          )}
                          {provider.status === "APPROVED" && (
                            <Button size="sm" variant="ghost" className="h-8 text-orange-600 hover:bg-orange-50" onClick={() => openSuspend(provider)}>
                              <Ban className="mr-1 h-4 w-4" /> Suspend
                            </Button>
                          )}
                          {provider.status === "SUSPENDED" && (
                            <Button size="sm" variant="ghost" className="h-8 text-teal-600 hover:bg-teal-50" onClick={() => setConfirmAction({ provider, action: "REACTIVATE" })}>
                              <RotateCcw className="mr-1 h-4 w-4" /> Reactivate
                            </Button>
                          )}
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

      <PaginationControls
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        pageSizeOptions={pagination.pageSizeOptions}
        totalItems={providers.length}
        rangeInfo={pagination.rangeInfo}
        goToPage={pagination.goToPage}
        setPageSize={pagination.setPageSize}
      />

      {/* Provider Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              <Building2 className="h-5 w-5" /> {selectedProvider?.name}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Registration details</DialogDescription>
          </DialogHeader>
          {selectedProvider && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedProvider.status} />
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">{selectedProvider.type.replace(/_/g, " ")}</span>
                {(selectedProvider.latitude !== 9.02 || selectedProvider.longitude !== 38.75) && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600"><Crosshair className="h-3 w-3" /> {selectedProvider.latitude.toFixed(4)}, {selectedProvider.longitude.toFixed(4)}</span>
                )}
              </div>
              <Separator />
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Owner</p>
                    <p className="font-medium">{selectedProvider.ownerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedProvider.phone}</p>
                  </div>
                </div>
                {selectedProvider.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedProvider.email}</p>
                    </div>
                  </div>
                )}
                {selectedProvider.address && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Address</p>
                      <p className="font-medium">{selectedProvider.address}</p>
                    </div>
                  </div>
                )}
                {selectedProvider.licenseNo && (
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">License No</p>
                      <p className="font-mono font-medium">{selectedProvider.licenseNo}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Registered</p>
                    <p className="font-medium">{formatDate(selectedProvider.createdAt)}</p>
                  </div>
                </div>
                {selectedProvider.approvedAt && (
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Approved {selectedProvider.approvedBy ? `by ${selectedProvider.approvedBy}` : ""}</p>
                      <p className="font-medium">{formatDate(selectedProvider.approvedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!isSuperuser && selectedProvider.status === "APPROVED" && (
                  <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openCoordPicker(selectedProvider); }}>
                    <MapPinned className="mr-1 h-3.5 w-3.5" /> Set Map Location
                  </Button>
                )}
                {selectedProvider.status === "APPROVED" && (
                  <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => { setDetailOpen(false); openSuspend(selectedProvider); }}>
                    <Ban className="h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
                {selectedProvider.status === "SUSPENDED" && (
                  <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={() => { setDetailOpen(false); setConfirmAction({ provider: selectedProvider, action: "REACTIVATE" }); }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                  </Button>
                )}
                {selectedProvider.licenseFile && (
                  <a href={selectedProvider.licenseFile} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs sm:text-sm font-medium text-primary hover:bg-muted">
                    <FileText className="h-4 w-4" /> View License
                  </a>
                )}
              </div>
              {selectedProvider.rejectionReason && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-red-600 text-xs">Rejection Reason</Label>
                    <p className="rounded-lg bg-red-50 p-3 text-xs sm:text-sm text-red-800">{selectedProvider.rejectionReason}</p>
                  </div>
                </>
              )}
              {selectedProvider.status === "SUSPENDED" && (selectedProvider as any).suspensionReason && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-orange-600 text-xs">Suspension Reason</Label>
                    <p className="rounded-lg bg-orange-50 p-3 text-xs sm:text-sm text-orange-800">{(selectedProvider as any).suspensionReason}</p>
                    {(selectedProvider as any).suspendedBy && (
                      <p className="text-[11px] text-slate-500">Suspended by: {(selectedProvider as any).suspendedBy}</p>
                    )}
                    {(selectedProvider as any).suspendedAt && (
                      <p className="text-[11px] text-slate-500">Suspended on: {formatDate((selectedProvider as any).suspendedAt)}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Coordinate Picker Dialog */}
      <Dialog open={coordOpen} onOpenChange={setCoordOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <MapPinned className="h-5 w-5" /> Set Location — {coordProvider?.name}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {coordProvider?.address ? `Address: ${coordProvider.address}` : "No address set for this provider"}
            </DialogDescription>
          </DialogHeader>
          {coordProvider && (
            <div className="space-y-4">
              {/* Map Picker */}
              <CoordinatePicker
                latitude={editLat}
                longitude={editLng}
                address={coordProvider.address || ""}
                onChange={(lat, lng) => { setEditLat(lat); setEditLng(lng); }}
              />

              {/* Manual input + Geocode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Latitude</Label>
                  <Input type="number" step="0.0001" value={editLat} onChange={(e) => setEditLat(parseFloat(e.target.value) || 9.02)} className="text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longitude</Label>
                  <Input type="number" step="0.0001" value={editLng} onChange={(e) => setEditLng(parseFloat(e.target.value) || 38.75)} className="text-xs font-mono" />
                </div>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {coordProvider.address && (
                  <Button variant="outline" onClick={geocodeSingle} disabled={geocodingOne} className="w-full sm:w-auto">
                    <Globe className={`mr-1 h-3.5 w-3.5 ${geocodingOne ? "animate-spin" : ""}`} />
                    {geocodingOne ? "Looking up..." : "Auto-detect from Address"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setCoordOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                <Button onClick={saveCoordinates} disabled={savingCoord} className="w-full sm:w-auto">
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${savingCoord ? "animate-spin" : ""}`} />
                  {savingCoord ? "Saving..." : "Save Location"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Geocode Dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Globe className="h-5 w-5" /> Batch Geocode All Providers
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Automatically converts provider addresses to GPS coordinates using OpenStreetMap.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                <li>Only processes APPROVED providers with an address</li>
                <li>Skips providers that already have real coordinates set</li>
                <li>Uses OpenStreetMap Nominatim (free, no API key needed)</li>
                <li>Takes ~1-2 seconds per provider due to rate limiting</li>
              </ul>
            </div>
            {!batchResult ? (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancel</Button>
                <Button onClick={batchGeocode} disabled={geocodingAll}>
                  <Globe className={`mr-1 h-3.5 w-3.5 ${geocodingAll ? "animate-spin" : ""}`} />
                  {geocodingAll ? "Geocoding..." : "Start Geocoding"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-lg font-bold text-emerald-600">{batchResult.updated}</p>
                    <p className="text-[10px] text-muted-foreground">Updated</p>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-lg font-bold text-red-600">{batchResult.failed}</p>
                    <p className="text-[10px] text-muted-foreground">Failed</p>
                  </div>
                  <div className="rounded-lg border p-2.5 text-center">
                    <p className="text-lg font-bold">{batchResult.total}</p>
                    <p className="text-[10px] text-muted-foreground">Processed</p>
                  </div>
                </div>
                {batchResult.results && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
                    {batchResult.results.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{r.address}</p>
                        </div>
                        {r.error ? (
                          <span className="text-red-600 shrink-0">Failed</span>
                        ) : (
                          <span className="font-mono text-emerald-600 shrink-0">{r.lat?.toFixed(4)}, {r.lng?.toFixed(4)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end">
                  <Button onClick={() => { setBatchOpen(false); setBatchResult(null); }}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="max-w-md mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-red-600">
              <XCircle className="h-5 w-5" /> Reject Provider
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Rejecting <strong>{rejectDialog?.name}</strong>. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-xs sm:text-sm">Rejection Reason *</Label>
            <Textarea id="reject-reason" placeholder="Enter the reason for rejection..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="text-sm" />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setRejectDialog(null)} disabled={actioning} className="w-full sm:w-auto">Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actioning || !rejectReason.trim()} className="w-full sm:w-auto">
              {actioning ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Approve/Suspend Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="mx-4 sm:mx-0 max-w-md w-[calc(100%-2rem)] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              {confirmAction?.action === "APPROVED" ? "Approve Provider" : confirmAction?.action === "REACTIVATE" ? "Reactivate Provider" : "Suspend Provider"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              {confirmAction?.action === "APPROVED"
                ? `Are you sure you want to approve "${confirmAction?.provider.name}"?`
                : confirmAction?.action === "REACTIVATE"
                ? `Are you sure you want to reactivate "${confirmAction?.provider.name}"? The guesthouse will regain full access.`
                : `Are you sure you want to suspend "${confirmAction?.provider.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel disabled={actioning} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && handleStatusAction(confirmAction.provider, confirmAction.action)}
              disabled={actioning}
              className={
                confirmAction?.action === "APPROVED"
                  ? "w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600"
                  : confirmAction?.action === "REACTIVATE"
                  ? "w-full sm:w-auto bg-teal-600 hover:bg-teal-700 focus:ring-teal-600"
                  : "w-full sm:w-auto bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
              }
            >
              {actioning ? "Processing..." : confirmAction?.action === "APPROVED" ? "Approve" : confirmAction?.action === "REACTIVATE" ? "Reactivate" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register Guesthouse Dialog (SUPERUSER) */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Building2 className="h-5 w-5" /> Register New Guesthouse
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Add a new guesthouse. It will be automatically approved and an operator account will be created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Guesthouse Info Section */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Guesthouse Information</p>
              <Separator />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-sm">Guesthouse Name <span className="text-rose-500">*</span></Label>
                <Input
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sunshine Guest House"
                  className="bg-slate-50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">Owner Name <span className="text-rose-500">*</span></Label>
                <Input
                  value={registerForm.ownerName}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, ownerName: e.target.value }))}
                  placeholder="Full name of the owner"
                  className="bg-slate-50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">Phone <span className="text-rose-500">*</span></Label>
                <Input
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+251..."
                  className="bg-slate-50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">Email <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="owner@email.com"
                  className="bg-slate-50"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">Type</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GUESTHOUSE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setRegisterForm((f) => ({ ...f, type: t.value }))}
                      className={`rounded-lg border-2 px-3 py-1.5 text-xs font-medium transition-all ${
                        registerForm.type === t.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-sm">Address <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  value={registerForm.address}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, address: e.target.value }))}
                  onBlur={async () => {
                    const addr = registerForm.address.trim();
                    if (!addr) return;
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr + ", Ethiopia")}&limit=1`, { headers: { "User-Agent": "GHMS-Registration/1.0" } });
                      const data = await res.json();
                      if (data?.length > 0) setRegisterForm((f) => ({ ...f, address: data[0].display_name }));
                    } catch { /* keep original */ }
                  }}
                  placeholder="Street, city, sub-city"
                  className="bg-slate-50"
                />
                <p className="text-[11px] text-slate-400">Address will be auto-normalized when you click away.</p>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-sm">License No <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input
                  value={registerForm.licenseNo}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, licenseNo: e.target.value }))}
                  placeholder="Business license number"
                  className="bg-slate-50"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label className="text-sm">Upload License <span className="text-slate-400 font-normal">(optional)</span></Label>
                {!registerForm.licenseFileData ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 transition-colors hover:border-primary/40 hover:bg-primary/5">
                    <Upload className="h-8 w-8 text-slate-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-600">Click to upload license document</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">PDF, Image, or any document (max 5MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error("File size must be under 5MB");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = reader.result as string;
                          setRegisterForm((f) => ({
                            ...f,
                            licenseFileData: base64,
                            licenseFileName: file.name,
                          }));
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <FileText className="h-8 w-8 shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{registerForm.licenseFileName}</p>
                      <p className="text-[11px] text-emerald-600">License uploaded</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegisterForm((f) => ({ ...f, licenseFileData: "", licenseFileName: "" }))}
                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-slate-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Operator Account Section */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operator Login Account</p>
              <p className="text-[11px] text-slate-400">An operator account will be created with access to manage this guesthouse.</p>
              <Separator />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Username <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="operator_username"
                  className="bg-slate-50"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  Password <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 4 characters"
                  className="bg-slate-50"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Info banner */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800">
                  This guesthouse will be <strong>automatically approved</strong> since you are registering it as System Admin. The operator can log in immediately after registration.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setRegisterOpen(false); setRegisterForm(emptyRegisterForm); }}
                disabled={registering}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                className="gap-1.5 w-full sm:w-auto"
                onClick={handleRegister}
                disabled={registering}
              >
                {registering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Register &amp; Approve
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend Provider Dialog (with reason + notification) */}
      <Dialog open={!!suspendDialog} onOpenChange={(open) => { if (!open) setSuspendDialog(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Ban className="h-5 w-5" />
              Suspend Guesthouse
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Suspend this provider and send them a notification with the reason.
            </DialogDescription>
          </DialogHeader>
          {suspendDialog && (
            <div className="space-y-4">
              {/* Provider info summary */}
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                    <Building2 className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">{suspendDialog.name}</p>
                    <p className="text-xs text-slate-500">{suspendDialog.ownerName} &middot; {suspendDialog.phone}</p>
                    {suspendDialog.address && (
                      <p className="text-[11px] text-slate-400 truncate">{suspendDialog.address}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Suspension Reason (required) */}
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Reason for Suspension <span className="text-rose-500">*</span>
                </Label>
                <Textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Write the detailed reason for suspending this guesthouse..."
                  className="min-h-[100px] resize-none"
                  maxLength={1000}
                />
                <p className="mt-1 text-[11px] text-slate-400 text-right">{suspensionReason.length}/1000</p>
              </div>

              {/* Short Message to Provider */}
              <div>
                <Label className="text-sm font-medium text-slate-700 mb-1.5 block">
                  Message to Provider <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Textarea
                  value={providerMessage}
                  onChange={(e) => setProviderMessage(e.target.value)}
                  placeholder="Short message that will be sent to the provider about their suspension..."
                  className="min-h-[80px] resize-none"
                  maxLength={500}
                />
                <p className="mt-1 text-[11px] text-slate-400 text-right">{providerMessage.length}/500</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  If empty, a default notification with the suspension reason will be sent automatically.
                </p>
              </div>

              {/* Warning */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    This action will immediately suspend the guesthouse. The provider will be notified via the notification system.
                    Suspended providers will be removed from room availability monitoring. Only the Police module can reactivate a suspended guesthouse.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSuspendDialog(null)}
                  disabled={suspending}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="gap-1.5 w-full sm:w-auto"
                  onClick={handleSuspend}
                  disabled={suspending || !suspensionReason.trim()}
                >
                  {suspending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Suspending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Suspend &amp; Send Notification
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
