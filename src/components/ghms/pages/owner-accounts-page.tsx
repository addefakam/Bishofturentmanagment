"use client";

import { useState, useEffect, useCallback } from "react";
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

const ROLE_CONFIG: Record<string, { label: string; badge: string; icon: React.ElementType; description: string }> = {
  SUPERUSER: {
    label: "System Admin",
    badge: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Lock,
    description: "System-wide admin. Can manage all accounts and reset credentials. Cannot write to business data.",
  },
  OPERATOR: {
    label: "Operator",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: Building2,
    description: "Full CRUD for their guesthouse. Can create staff accounts. Cannot access other providers' data.",
  },
  STAFF: {
    label: "Staff",
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    icon: Users,
    description: "Limited access based on assigned permissions. Can only view permitted sections.",
  },
  POLICE: {
    label: "Police",
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    icon: Shield,
    description: "Read-only access to all guesthouses. Hierarchy: ADMIN > DETECTIVE > OFFICER > VIEWER.",
  },
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
  ADMIN: "Full management rights. Can create/edit/delete all police accounts of any rank.",
  DETECTIVE: "Can create Officer & Viewer accounts. Can edit/delete officers below Detective rank.",
  OFFICER: "Standard police access. Read-only for police management.",
  VIEWER: "Basic read-only access to dashboard and providers only.",
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
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Determine if current user can manage police
  const canManagePolice =
    currentUser?.role === "SUPERUSER" ||
    (currentUser?.role === "POLICE" &&
      (RANK_ORDER[currentUser?.policeRank || ""] || 0) >= RANK_ORDER.DETECTIVE);

  // Which ranks can this user create?
  const maxCreatableRank =
    currentUser?.role === "SUPERUSER"
      ? "ADMIN"
      : currentUser?.role === "POLICE"
        ? currentUser?.policeRank === "ADMIN"
          ? "DETECTIVE"
          : currentUser?.policeRank === "DETECTIVE"
            ? "OFFICER"
            : ""
        : "";

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
      const data: ApiResponse = await apiGetOwnerAccounts();
      setProviders(data.providers);
      setPoliceUsers(data.policeUsers);
    } catch {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleReset = async (e: React.FormEvent) => {
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
    setPoliceRank(maxCreatableRank === "DETECTIVE" ? "OFFICER" : "VIEWER");
    setShowPolicePassword(false);
    setPoliceDialogOpen(true);
  };

  const openEditPolice = (police: AccountUser) => {
    if (!canManagePolice) return;
    // Cannot edit self
    if (currentUser?.role === "POLICE" && police.id === currentUser.id) {
      toast.error("Cannot edit your own account");
      return;
    }
    // Check if we can edit this rank
    if (currentUser?.role === "POLICE") {
      const targetLevel = RANK_ORDER[police.policeRank || "OFFICER"] || 0;
      const myLevel = RANK_ORDER[currentUser.policeRank || "OFFICER"] || 0;
      if (targetLevel >= myLevel) {
        toast.error(`Cannot edit a ${POLICE_RANK_LABEL[police.policeRank || ""] || "officer"}`);
        return;
      }
    }
    setEditMode(true);
    setEditPoliceId(police.id);
    setPoliceName(police.name);
    setPoliceUsername(police.username);
    setPolicePassword("");
    setPoliceRank(police.policeRank || "OFFICER");
    setShowPolicePassword(false);
    setPoliceDialogOpen(true);
  };

  const openDeletePolice = (police: AccountUser) => {
    if (!canManagePolice) return;
    if (currentUser?.role === "POLICE" && police.id === currentUser.id) {
      toast.error("Cannot delete your own account");
      return;
    }
    setDeleteTarget(police);
    setDeleteOpen(true);
  };

  const handleSavePolice = async (e: React.FormEvent) => {
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
        const data: Record<string, unknown> = { name: policeName.trim(), policeRank };
        if (policePassword.trim()) data.password = policePassword.trim();
        await apiPoliceUpdateOfficer(editPoliceId, data);
        toast.success("Police officer updated");
      } else {
        await apiPoliceCreateOfficer({
          name: policeName.trim(),
          username: policeUsername.trim(),
          password: policePassword.trim(),
          policeRank,
        });
        toast.success("Police officer created");
      }
      setPoliceDialogOpen(false);
      fetchPoliceOnly();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save police officer";
      toast.error(msg);
    } finally {
      setPoliceSaving(false);
    }
  };

  const handleDeletePolice = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiPoliceDeleteOfficer(deleteTarget.id);
      toast.success("Police officer deleted");
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchPoliceOnly();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
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
    const isSelf = currentUser?.role === "POLICE" && police.id === currentUser.id;
    const canEdit = canManagePolice && !isSelf;
    const canDelete =
      canManagePolice &&
      !isSelf &&
      (currentUser?.role === "SUPERUSER" ||
        (RANK_ORDER[currentUser?.policeRank || ""] || 0) > (RANK_ORDER[rank] || 0));

    if (isMobile) {
      return (
        <div key={police.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100">
              <Shield className="h-4 w-4 text-rose-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{police.name}</p>
                <Badge variant="outline" className={POLICE_RANK_BADGE[rank] || ""}>
                  {rank}
                </Badge>
                {isSelf && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                    You
                  </Badge>
                )}
              </div>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{police.username}</code>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Created: {new Date(police.createdAt).toLocaleDateString()}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => openPoliceReset(police)}>
              <KeyRound className="h-3.5 w-3.5" />
              Reset
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditPolice(police)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => openDeletePolice(police)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <tr key={police.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
              <Shield className="h-4 w-4 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{police.name}</span>
                {isSelf && (
                  <Badge variant="outline" className="text-[9px] bg-blue-100 text-blue-700 border-blue-200">
                    You
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{police.username}</code>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className={POLICE_RANK_BADGE[rank] || ""}>
            {rank}
          </Badge>
        </td>
        <td className="px-4 py-3 text-muted-foreground text-xs">
          {new Date(police.createdAt).toLocaleDateString()}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openPoliceReset(police)}>
              <KeyRound className="h-3.5 w-3.5" />
              Reset
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEditPolice(police)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => openDeletePolice(police)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, roles, credentials, and provider approvals.
          </p>
        </div>
      </div>

      {/* ── RBAC Role Reference Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(ROLE_CONFIG).map(([role, config]) => {
          const Icon = config.icon;
          return (
            <Card key={role} className="border shadow-none">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <Badge variant="outline" className={`text-[10px] font-semibold mb-1 ${config.badge}`}>
                      {config.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">{config.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <Building2 className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalProviders}</p>
              <p className="text-xs text-muted-foreground">Total Providers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <CheckCircle2 className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedProviders}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingProviders}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100">
              <Shield className="size-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPolice}</p>
              <p className="text-xs text-muted-foreground">Police Officers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        {([
          { key: "overview", label: "Overview", icon: UserCog },
          { key: "owners", label: "Providers", icon: Building2, count: totalProviders },
          { key: "police", label: "Police", icon: Shield, count: totalPolice },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key as TabType);
              setSearch("");
            }}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {"count" in tab && tab.count !== undefined && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
                {tab.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="flex gap-2 max-w-lg">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              activeTab === "police"
                ? "Search by name or username..."
                : "Search by provider, owner, phone, or username..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {activeTab === "police" && canManagePolice && maxCreatableRank && (
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
                      Reset
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t my-4" />

          {/* Police Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="size-5 text-rose-600" />
              <h2 className="text-lg font-semibold">Police Accounts</h2>
              <Badge variant="secondary">{filteredPolice.length}</Badge>
            </div>
            <div className="space-y-2">
              {filteredPolice.map((police) => (
                <div
                  key={police.id}
                  className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => openPoliceReset(police)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                    <Shield className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{police.name}</p>
                      <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">
                        POLICE
                      </Badge>
                      {police.policeRank && (
                        <Badge variant="outline" className={POLICE_RANK_BADGE[police.policeRank] || ""}>
                          {police.policeRank}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <code className="font-mono">{police.username}</code> · Created {new Date(police.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {canManagePolice && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => { e.stopPropagation(); openEditPolice(police); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); openDeletePolice(police); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="size-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Data Security Notice</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  All passwords are stored with bcrypt hashing. Authentication uses JWT tokens in httpOnly cookies. 
                  Role-based access control (RBAC) is enforced on all API endpoints server-side. Every user management 
                  action is logged in the audit trail.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : activeTab === "owners" ? (
        /* ─── Owners Tab ─── */
        <>
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
                      <td className="px-4 py-3 text-muted-foreground">{provider.ownerName}</td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {ownerUser?.username || "—"}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{provider.phone}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS_BADGE[provider.status] || ""}>
                          {provider.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openOwnerReset(provider)}>
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

          <div className="md:hidden space-y-3">
            {filteredProviders.map((provider) => {
              const ownerUser = provider.users[0];
              return (
                <div key={provider.id} className="rounded-lg border p-4 space-y-3">
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
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{ownerUser?.username || "—"}</code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm">{provider.phone}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => openOwnerReset(provider)}>
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
          {/* Rank legend */}
          <Card className="border shadow-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="size-4 text-amber-600" />
                <p className="text-sm font-semibold">Police Rank Hierarchy</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(POLICE_RANK_LABEL).map(([rank, label]) => (
                  <div key={rank} className="flex items-start gap-2">
                    <Badge variant="outline" className={`text-[10px] mt-0.5 shrink-0 ${POLICE_RANK_BADGE[rank]}`}>
                      {rank}
                    </Badge>
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{POLICE_RANK_DESC[rank]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
              <tbody>{filteredPolice.map((p) => renderPoliceRow(p))}</tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPolice.map((p) => renderPoliceRow(p, true))}
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
                Only fill this in if a password reset is requested. The new password will be securely hashed with bcrypt.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : <><KeyRound className="h-4 w-4" />Save Credentials</>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Police Officer Dialog ── */}
      <Dialog open={policeDialogOpen} onOpenChange={setPoliceDialogOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-rose-600" />
              {editMode ? "Edit Police Officer" : "Add Police Officer"}
            </DialogTitle>
            <DialogDescription>
              {editMode
                ? "Update officer details. Leave password blank to keep current."
                : "Create a new police officer account with the appropriate rank and permissions."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePolice} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="police-name">Full Name *</Label>
              <Input
                id="police-name"
                placeholder="e.g. Officer Kebede"
                value={policeName}
                onChange={(e) => setPoliceName(e.target.value)}
                autoFocus
              />
            </div>

            {!editMode && (
              <div className="space-y-2">
                <Label htmlFor="police-username">Username *</Label>
                <Input
                  id="police-username"
                  placeholder="e.g. kebede"
                  value={policeUsername}
                  onChange={(e) => setPoliceUsername(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="police-rank">Rank *</Label>
              <Select value={policeRank} onValueChange={setPoliceRank}>
                <SelectTrigger id="police-rank">
                  <SelectValue placeholder="Select rank" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(POLICE_RANK_LABEL).map(([rank, label]) => {
                    const rankLevel = RANK_ORDER[rank] || 0;
                    const maxLevel = RANK_ORDER[maxCreatableRank] || 0;
                    const isDisabled =
                      currentUser?.role === "POLICE" && rankLevel >= maxLevel;
                    return (
                      <SelectItem key={rank} value={rank} disabled={isDisabled}>
                        <div className="flex items-center gap-2">
                          <span>{label}</span>
                          {isDisabled && (
                            <span className="text-xs text-muted-foreground">(above your level)</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {POLICE_RANK_DESC[policeRank]}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="police-password">{editMode ? "New Password" : "Password"} *</Label>
              <div className="relative">
                <Input
                  id="police-password"
                  type={showPolicePassword ? "text" : "password"}
                  placeholder={editMode ? "Leave blank to keep current" : "Set initial password"}
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
              <Button type="button" variant="outline" onClick={() => setPoliceDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={policeSaving} className="gap-2">
                {policeSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
                ) : editMode ? (
                  <><Pencil className="h-4 w-4" />Update Officer</>
                ) : (
                  <><Plus className="h-4 w-4" />Create Officer</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="mx-4 sm:mx-0 w-[calc(100%-2rem)] sm:w-full sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Police Officer
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.username})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleting} className="gap-2" onClick={handleDeletePolice}>
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4" />Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
