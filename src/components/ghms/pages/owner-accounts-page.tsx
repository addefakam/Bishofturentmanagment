"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetOwnerAccounts,
  apiUpdateOwnerAccount,
  apiPoliceOfficers,
  apiPoliceCreateOfficer,
  apiPoliceUpdateOfficer,
  apiPoliceDeleteOfficer,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  UserCog,
  KeyRound,
  Building2,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  Search,
  Users,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  ChevronRight,
  Info,
  Plus,
  Pencil,
  Trash2,
  Crown,
} from "lucide-react";

interface AccountUser {
  id: string;
  username: string;
  name: string;
  role: string;
  policeRank?: string;
  providerId: string | null;
  permissions?: string;
  createdAt: string;
  provider?: { name: string } | null;
}

interface ProviderWithOwner {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  status: string;
  createdAt: string;
  users: AccountUser[];
}

interface ApiResponse {
  providers: ProviderWithOwner[];
  policeUsers: AccountUser[];
}

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  SUSPENDED: "bg-slate-200 text-slate-700 border-slate-300",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  APPROVED: <CheckCircle2 className="size-4 text-emerald-600" />,
  PENDING: <Clock className="size-4 text-amber-600" />,
  REJECTED: <Ban className="size-4 text-red-600" />,
  SUSPENDED: <AlertTriangle className="size-4 text-slate-600" />,
};

const POLICE_RANK_BADGE: Record<string, string> = {
  ADMIN: "bg-amber-100 text-amber-800 border-amber-200",
  DETECTIVE: "bg-violet-100 text-violet-800 border-violet-200",
  OFFICER: "bg-sky-100 text-sky-800 border-sky-200",
  VIEWER: "bg-slate-100 text-slate-600 border-slate-200",
};

const POLICE_RANK_LABEL: Record<string, string> = {
  ADMIN: "Police Admin",
  DETECTIVE: "Detective",
  OFFICER: "Officer",
  VIEWER: "Viewer",
};

const POLICE_RANK_DESC: Record<string, string> = {
  ADMIN: "Full management rights. Can create/edit/delete all police accounts below ADMIN.",
  DETECTIVE: "Can create Officer & Viewer accounts. Can edit/delete officers below Detective rank.",
  OFFICER: "Can create Viewer accounts. Can edit/delete viewers.",
  VIEWER: "Basic read-only access. Cannot create or manage other police.",
};

// Rank hierarchy for permission check
const RANK_ORDER: Record<string, number> = { VIEWER: 0, OFFICER: 1, DETECTIVE: 2, ADMIN: 3 };

type TabType = "overview" | "owners" | "police";

export default function OwnerAccountsPage() {
  const { currentUser, refreshKey } = useAppStore();
  const [providers, setProviders] = useState<ProviderWithOwner[]>([]);
  const [policeUsers, setPoliceUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>(
    currentUser?.role === "POLICE" ? "police" : "overview"
  );

  // Determine if current user can manage police
  const canManagePolice =
    currentUser?.role === "SUPERUSER" ||
    (currentUser?.role === "POLICE" &&
      (RANK_ORDER[currentUser?.policeRank || ""] || 0) >= RANK_ORDER.OFFICER);

  // Which ranks can this user create?
  // - SUPERUSER: ADMIN only (server-side enforces the same constraint)
  // - POLICE: one level below their own rank
  const maxCreatableRank =
    currentUser?.role === "SUPERUSER"
      ? "ADMIN"
      : currentUser?.role === "POLICE"
        ? currentUser?.policeRank === "ADMIN"
          ? "DETECTIVE"
          : currentUser?.policeRank === "DETECTIVE"
            ? "OFFICER"
            : currentUser?.policeRank === "OFFICER"
              ? "VIEWER"
              : ""
        : "";

  // Ranks available in the dropdown for the Add/Edit dialog
  // - SUPERUSER: only ADMIN
  // - POLICE: from VIEWER up to maxCreatableRank
  const availableRanks =
    currentUser?.role === "SUPERUSER"
      ? ["ADMIN"]
      : maxCreatableRank
        ? Object.keys(RANK_ORDER).filter((r) => (RANK_ORDER[r] || 0) <= (RANK_ORDER[maxCreatableRank] || 0))
        : [];

  // Whether the current user can edit/delete a specific police officer.
  // - SUPERUSER: only ADMIN-rank officers
  // - POLICE: ranks strictly below their own (existing logic)
  const canManageOfficer = (police: AccountUser): boolean => {
    if (!canManagePolice) return false;
    if (police.id === currentUser?.id) return false;
    if (currentUser?.role === "SUPERUSER") {
      return (police.policeRank || "OFFICER") === "ADMIN";
    }
    // POLICE
    const myRank = (currentUser?.policeRank || "VIEWER") as string;
    const myLevel = RANK_ORDER[myRank] || 0;
    const targetLevel = RANK_ORDER[police.policeRank || "OFFICER"] || 0;
    return targetLevel < myLevel;
  };

  // ── Reset credentials dialog ──
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetLabel, setResetLabel] = useState("");
  const [resetSublabel, setResetSublabel] = useState("");

  // ── Add/Edit police dialog ──
  const [policeDialogOpen, setPoliceDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPoliceId, setEditPoliceId] = useState("");
  const [policeName, setPoliceName] = useState("");
  const [policeUsername, setPoliceUsername] = useState("");
  const [policePassword, setPolicePassword] = useState("");
  const [policeRank, setPoliceRank] = useState("OFFICER");
  const [policeSaving, setPoliceSaving] = useState(false);
  const [showPolicePassword, setShowPolicePassword] = useState(false);

  // ── Delete confirmation ──
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      if (currentUser?.role === "POLICE") {
        // POLICE users fetch from police-officers endpoint
        const data = await apiPoliceOfficers();
        setPoliceUsers(data);
      } else {
        const data: ApiResponse = await apiGetOwnerAccounts();
        setProviders(data.providers);
        setPoliceUsers(data.policeUsers);
      }
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.role]);

  const fetchPoliceOnly = useCallback(async () => {
    try {
      const data = await apiPoliceOfficers();
      setPoliceUsers(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts, refreshKey]);

  // ── Owner reset handlers ──
  const openOwnerReset = (provider: ProviderWithOwner) => {
    const ownerUser = provider.users[0];
    setResetUserId(ownerUser?.id || "");
    setResetUsername(ownerUser?.username || "");
    setResetPassword("");
    setShowPassword(false);
    setResetLabel(provider.name);
    setResetSublabel(`${provider.ownerName}  ·  ${provider.phone}`);
    setResetOpen(true);
  };

  const openPoliceReset = (police: AccountUser) => {
    setResetUserId(police.id);
    setResetUsername(police.username);
    setResetPassword("");
    setShowPassword(false);
    setResetLabel("Police Account");
    setResetSublabel(police.name);
    setResetOpen(true);
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    if (!resetUsername.trim()) {
      toast.error("Username is required");
      return;
    }
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {};
      if (resetUsername.trim()) updateData.username = resetUsername.trim();
      if (resetPassword.trim()) updateData.password = resetPassword.trim();
      if (Object.keys(updateData).length === 0) {
        toast.error("No changes to save");
        setSaving(false);
        return;
      }
      await apiUpdateOwnerAccount(resetUserId, updateData);
      toast.success("Credentials updated successfully");
      setResetOpen(false);
      fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update credentials";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Police CRUD handlers ──
  const openAddPolice = () => {
    setEditMode(false);
    setEditPoliceId("");
    setPoliceName("");
    setPoliceUsername("");
    setPolicePassword("");
    setPoliceRank(
      maxCreatableRank === "DETECTIVE"
        ? "OFFICER"
        : maxCreatableRank === "OFFICER"
          ? "VIEWER"
          : availableRanks[0] || "VIEWER"
    );
    setShowPolicePassword(false);
    setPoliceDialogOpen(true);
  };

  const openEditPolice = (police: AccountUser) => {
    setEditMode(true);
    setEditPoliceId(police.id);
    setPoliceName(police.name);
    setPoliceUsername(police.username);
    setPolicePassword("");
    setPoliceRank(police.policeRank || "VIEWER");
    setShowPolicePassword(false);
    setPoliceDialogOpen(true);
  };

  const handlePoliceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!policeName.trim() || !policeUsername.trim()) {
      toast.error("Name and username are required");
      return;
    }
    if (!editMode && !policePassword.trim()) {
      toast.error("Password is required for new accounts");
      return;
    }

    setPoliceSaving(true);
    try {
      if (editMode) {
        // Update existing officer
        const updateData: Record<string, unknown> = {
          id: editPoliceId,
          name: policeName.trim(),
          policeRank,
        };
        if (policePassword.trim()) {
          updateData.password = policePassword.trim();
        }
        await apiPoliceUpdateOfficer(updateData);
        toast.success("Officer updated successfully");
      } else {
        // Create new officer
        await apiPoliceCreateOfficer({
          username: policeUsername.trim(),
          password: policePassword.trim(),
          name: policeName.trim(),
          policeRank,
        });
        toast.success("Officer created successfully");
      }
      setPoliceDialogOpen(false);
      fetchPoliceOnly();
      if (currentUser?.role !== "POLICE") fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save officer";
      toast.error(msg);
    } finally {
      setPoliceSaving(false);
    }
  };

  const openDeleteConfirm = (police: AccountUser) => {
    setDeleteTarget(police);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiPoliceDeleteOfficer(deleteTarget.id);
      toast.success("Officer deleted successfully");
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchPoliceOnly();
      if (currentUser?.role !== "POLICE") fetchAccounts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete officer";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtering ──
  const filteredProviders = providers.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search) ||
      p.users.some((u) => u.username.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPolice = policeUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  const hasNoResults =
    (activeTab === "overview" && filteredProviders.length === 0 && filteredPolice.length === 0) ||
    (activeTab === "owners" && filteredProviders.length === 0) ||
    (activeTab === "police" && filteredPolice.length === 0);

  const totalProviders = providers.length;
  const approvedProviders = providers.filter((p) => p.status === "APPROVED").length;
  const pendingProviders = providers.filter((p) => p.status === "PENDING").length;
  const totalPolice = policeUsers.length;

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render Police Table Row ──
  const renderPoliceRow = (police: AccountUser, isMobile = false) => {
    const rank = police.policeRank || "OFFICER";
    const isSelf = police.id === currentUser?.id;

    if (isMobile) {
      return (
        <div key={police.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100">
              <Shield className="h-4 w-4 text-rose-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">{police.name}</p>
                {rank !== "OFFICER" && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 ${POLICE_RANK_BADGE[rank] || ""}`}>
                    {POLICE_RANK_LABEL[rank] || rank}
                  </Badge>
                )}
                {isSelf && (
                  <Badge variant="secondary" className="text-[10px] px-1.5">You</Badge>
                )}
              </div>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {police.username}
              </code>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Created: {new Date(police.createdAt).toLocaleDateString()}
          </p>

          <div className="flex gap-2">
            {canManageOfficer(police) && (
              <>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openEditPolice(police)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => openDeleteConfirm(police)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openPoliceReset(police)}>
              <KeyRound className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      );
    }

    // Desktop row
    return (
      <tr key={police.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
              <Shield className="h-4 w-4 text-rose-600" />
            </div>
            <span className="font-medium">{police.name}</span>
            {isSelf && (
              <Badge variant="secondary" className="text-[10px] px-1.5">You</Badge>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            {police.username}
          </code>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className={`text-xs ${POLICE_RANK_BADGE[rank] || "bg-rose-100 text-rose-700 border-rose-200"}`}>
            {POLICE_RANK_LABEL[rank] || rank}
          </Badge>
        </td>
        <td className="px-4 py-3 text-muted-foreground text-xs">
          {new Date(police.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {canManageOfficer(police) && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditPolice(police)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => openDeleteConfirm(police)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openPoliceReset(police)}>
              <KeyRound className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {currentUser?.role === "POLICE"
            ? "Manage Officers"
            : currentUser?.role === "SUPERUSER"
              ? "Account Management"
              : "Account Management"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {currentUser?.role === "POLICE"
            ? "Create and manage police officers. You can manage ranks below your current rank."
            : currentUser?.role === "SUPERUSER"
              ? "Manage Police Admin accounts (create, edit, delete, reset credentials) and reset credentials for guesthouse owners. Suspend guesthouses from the Guesthouses page."
              : "Manage owner accounts and police officers."}
        </p>
      </div>

      {/* Tabs — POLICE users only see the police tab */}
      {currentUser?.role !== "POLICE" && (
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
          {([
            { key: "overview" as TabType, label: "Overview", icon: Users, count: totalProviders + totalPolice },
            { key: "owners" as TabType, label: "Owners", icon: Building2, count: totalProviders },
            { key: "police" as TabType, label: "Police", icon: Shield, count: totalPolice },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); }}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                {tab.count}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Search + Add Officer */}
      <div className="flex gap-2 max-w-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              activeTab === "police" || currentUser?.role === "POLICE"
                ? "Search by name or username..."
                : "Search by provider, owner, phone, or username..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {(activeTab === "police" || currentUser?.role === "POLICE") && canManagePolice && maxCreatableRank && (
          <Button onClick={openAddPolice} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Officer
          </Button>
        )}
      </div>

      {hasNoResults ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <UserCog className="mb-4 h-12 w-12 opacity-30" />
          <p className="font-medium text-lg">
            {search ? "No matching accounts" : `No ${activeTab} accounts found`}
          </p>
          <p className="text-sm mt-1">
            {search
              ? "Try adjusting your search terms."
              : "Accounts will appear here when providers register or police accounts are created."}
          </p>
        </div>
      ) : activeTab === "overview" ? (
        /* ─── Overview Tab ─── */
        <>
          {/* Providers Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="size-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">Provider Accounts</h2>
              <Badge variant="secondary">{filteredProviders.length}</Badge>
            </div>
            <div className="space-y-2">
              {filteredProviders.map((provider) => {
                const ownerUser = provider.users[0];
                return (
                  <div
                    key={provider.id}
                    className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openOwnerReset(provider)}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{provider.name}</p>
                        {STATUS_ICON[provider.status]}
                        <Badge variant="outline" className={STATUS_BADGE[provider.status] || ""}>
                          {provider.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {provider.ownerName} · {provider.phone} · <code className="font-mono">{ownerUser?.username || "—"}</code>
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset Credentials
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Police Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="size-5 text-rose-600" />
              <h2 className="text-lg font-semibold">Police Accounts</h2>
              <Badge variant="secondary">{filteredPolice.length}</Badge>
              {canManagePolice && maxCreatableRank && (
                <Button size="sm" className="ml-auto gap-1.5" onClick={openAddPolice}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Officer
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {filteredPolice.map((police) => (
                <div
                  key={police.id}
                  className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                    <Shield className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{police.name}</p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${POLICE_RANK_BADGE[police.policeRank || ""] || "bg-rose-100 text-rose-700 border-rose-200"}`}>
                        {POLICE_RANK_LABEL[police.policeRank || ""] || "Officer"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <code className="font-mono">{police.username}</code> · Created {new Date(police.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canManageOfficer(police) && (
                      <>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditPolice(police)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => openDeleteConfirm(police)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openPoliceReset(police)}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : activeTab === "owners" ? (
        /* ─── Owners Tab ─── */
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold">Provider</th>
                  <th className="px-4 py-3 text-left font-semibold">Owner</th>
                  <th className="px-4 py-3 text-left font-semibold">Username</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProviders.map((provider) => {
                  const ownerUser = provider.users[0];
                  return (
                    <tr
                      key={provider.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{provider.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {provider.ownerName}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {ownerUser?.username || "—"}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {provider.phone}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS_BADGE[provider.status] || ""}>
                          {provider.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openOwnerReset(provider)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset Credentials
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredProviders.map((provider) => {
              const ownerUser = provider.users[0];
              return (
                <div
                  key={provider.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{provider.name}</p>
                        <p className="text-xs text-muted-foreground">{provider.ownerName}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={STATUS_BADGE[provider.status] || ""}>
                      {provider.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Username</p>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {ownerUser?.username || "—"}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm">{provider.phone}</p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => openOwnerReset(provider)}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset Credentials
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* ─── Police Tab ─── */
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold">Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Username</th>
                  <th className="px-4 py-3 text-left font-semibold">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPolice.map((police) => renderPoliceRow(police, false))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPolice.map((police) => renderPoliceRow(police, true))}
          </div>
        </>
      )}

      {/* ── Reset Credentials Dialog ── */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Reset Credentials
            </DialogTitle>
            <DialogDescription>
              Update login credentials for <strong>{resetLabel}</strong>{resetSublabel ? ` — ${resetSublabel}` : ""}.
              Leave password blank to keep the current password unchanged.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-username">Username *</Label>
              <Input
                id="reset-username"
                placeholder="Enter new username"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Leave blank to keep current password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Only fill this in if a password reset is requested.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Save Credentials
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Police Dialog ── */}
      <Dialog open={policeDialogOpen} onOpenChange={setPoliceDialogOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-rose-600" />
              {editMode ? "Edit Officer" : "Add New Officer"}
            </DialogTitle>
            <DialogDescription>
              {editMode
                ? currentUser?.role === "SUPERUSER"
                  ? "Update the Police Admin's name or password. Rank stays as ADMIN."
                  : "Update officer details. Change rank or name as needed."
                : currentUser?.role === "SUPERUSER"
                  ? "Create a new Police Admin account. Only ADMIN-rank officers can be created by the Superuser; lower ranks are managed by the Police Admin."
                  : `Create a new police officer with ${POLICE_RANK_LABEL[maxCreatableRank] || ""} rank or below.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePoliceSubmit} className="space-y-4">
            {!editMode && (
              <div className="space-y-2">
                <Label htmlFor="police-username">Username *</Label>
                <Input
                  id="police-username"
                  placeholder="e.g. officer-habtamu"
                  value={policeUsername}
                  onChange={(e) => setPoliceUsername(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="police-name">Full Name *</Label>
              <Input
                id="police-name"
                placeholder="e.g. Officer Habtamu"
                value={policeName}
                onChange={(e) => setPoliceName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="police-rank">Rank *</Label>
              <Select value={policeRank} onValueChange={setPoliceRank}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rank" />
                </SelectTrigger>
                <SelectContent>
                  {availableRanks.map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex items-center gap-2">
                        <span>{POLICE_RANK_LABEL[r] || r}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {currentUser?.role === "SUPERUSER"
                  ? "Superuser can only create and manage ADMIN-rank police accounts. Lower ranks (DETECTIVE, OFFICER, VIEWER) are managed by the Police Admin."
                  : POLICE_RANK_DESC[policeRank] || ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="police-password">
                {editMode ? "New Password" : "Password *"}
              </Label>
              <div className="relative">
                <Input
                  id="police-password"
                  type={showPolicePassword ? "text" : "password"}
                  placeholder={editMode ? "Leave blank to keep current" : "Enter password"}
                  value={policePassword}
                  onChange={(e) => setPolicePassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPolicePassword(!showPolicePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPolicePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPoliceDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={policeSaving} className="gap-2">
                {policeSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {editMode ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    {editMode ? "Update Officer" : "Create Officer"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Officer
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.username})?
              This action cannot be undone. They will lose all access to the system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-2">
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Officer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
