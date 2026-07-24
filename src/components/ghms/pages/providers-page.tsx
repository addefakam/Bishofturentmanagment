"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { useAppStore } from "@/lib/store";
import { apiGetProviders, apiUpdateProvider } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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
  createdAt: string;
  updatedAt: string;
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

export default function ProvidersPage() {
  const { refreshKey, triggerRefresh } = useAppStore();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Action dialogs
  const [rejectDialog, setRejectDialog] = useState<Provider | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ provider: Provider; action: string } | null>(null);
  const [actioning, setActioning] = useState(false);

  const pagination = usePagination({ totalItems: providers.length, initialPageSize: 10, pageSizeOptions: [5, 10, 20, 50] });
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
      await apiUpdateProvider(provider.id, { status });
      toast.success(`Provider ${status.toLowerCase()}`);
      setConfirmAction(null);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update provider";
      toast.error(message);
    } finally {
      setActioning(false);
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

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-3">
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
      </div>

      {/* Providers — Cards on mobile, Table on lg+ */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3 sm:px-6 sm:py-4">
          <h2 className="text-base sm:text-lg font-semibold">Provider Applications</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage registrations and licensing
          </p>
        </div>

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
                <div key={provider.id} className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openDetail(provider)}
                    >
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{provider.name}</p>
                        <StatusBadge status={provider.status} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {provider.ownerName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {provider.phone}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium">
                          {provider.type.replace(/_/g, " ")}
                        </span>
                        {provider.licenseNo && (
                          <span className="font-mono">Lic: {provider.licenseNo}</span>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Action buttons — always visible on mobile */}
                  <div className="mt-2.5 flex items-center gap-1.5 border-t pt-2.5">
                    <button
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 active:bg-slate-200 sm:hidden"
                      onClick={() => openDetail(provider)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>
                    {provider.status !== "APPROVED" && (
                      <button
                        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100"
                        onClick={() => setConfirmAction({ provider, action: "APPROVED" })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="hidden xs:inline">Approve</span>
                      </button>
                    )}
                    {provider.status !== "REJECTED" && (
                      <button
                        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100"
                        onClick={() => openReject(provider)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="hidden xs:inline">Reject</span>
                      </button>
                    )}
                    {provider.status === "APPROVED" && (
                      <button
                        className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 active:bg-orange-100"
                        onClick={() => setConfirmAction({ provider, action: "SUSPENDED" })}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Suspend
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
                    <TableHead>Owner</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>License No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProviders.map((provider) => (
                    <TableRow
                      key={provider.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(provider)}
                    >
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>{provider.ownerName}</TableCell>
                      <TableCell>{provider.phone}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{provider.email || "—"}</TableCell>
                      <TableCell>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium">
                          {provider.type.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{provider.licenseNo || "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={provider.status} />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {provider.status !== "APPROVED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() => setConfirmAction({ provider, action: "APPROVED" })}
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                          )}
                          {provider.status !== "REJECTED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => openReject(provider)}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          )}
                          {provider.status === "APPROVED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                              onClick={() => setConfirmAction({ provider, action: "SUSPENDED" })}
                            >
                              <Ban className="mr-1 h-4 w-4" />
                              Suspend
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

      {/* Pagination Controls */}
      {!loading && providers.length > 0 && (
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
      )}

      {/* Provider Detail Dialog — mobile optimized */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
              <Building2 className="h-5 w-5" />
              {selectedProvider?.name}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Registration details</DialogDescription>
          </DialogHeader>
          {selectedProvider && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedProvider.status} />
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                  {selectedProvider.type.replace(/_/g, " ")}
                </span>
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

              {selectedProvider.licenseFile && (
                <a
                  href={selectedProvider.licenseFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs sm:text-sm font-medium text-primary hover:bg-muted transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  View License File
                </a>
              )}

              {selectedProvider.rejectionReason && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <Label className="text-red-600 text-xs">Rejection Reason</Label>
                    <p className="rounded-lg bg-red-50 p-3 text-xs sm:text-sm text-red-800">
                      {selectedProvider.rejectionReason}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog — mobile optimized */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="max-w-md mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Provider
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Rejecting <strong>{rejectDialog?.name}</strong>. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-xs sm:text-sm">Rejection Reason *</Label>
            <Textarea
              id="reject-reason"
              placeholder="Enter the reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setRejectDialog(null)} disabled={actioning} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actioning || !rejectReason.trim()}
              className="w-full sm:w-auto"
            >
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
              {confirmAction?.action === "APPROVED" ? "Approve Provider" : "Suspend Provider"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              {confirmAction?.action === "APPROVED"
                ? `Are you sure you want to approve "${confirmAction?.provider.name}"?`
                : `Are you sure you want to suspend "${confirmAction?.provider.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel disabled={actioning} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmAction && handleStatusAction(confirmAction.provider, confirmAction.action)
              }
              disabled={actioning}
              className={
                confirmAction?.action === "APPROVED"
                  ? "w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600"
                  : "w-full sm:w-auto bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
              }
            >
              {actioning ? "Processing..." : confirmAction?.action === "APPROVED" ? "Approve" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}