"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetOwnerAccounts,
  apiUpdateOwnerAccount,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  UserCog,
  KeyRound,
  Building2,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";

interface AccountUser {
  id: string;
  username: string;
  name: string;
  role: string;
  providerId: string | null;
  createdAt: string;
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

type TabType = "owners" | "police";

export default function OwnerAccountsPage() {
  const { refreshKey } = useAppStore();
  const [providers, setProviders] = useState<ProviderWithOwner[]>([]);
  const [policeUsers, setPoliceUsers] = useState<AccountUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("owners");

  // Reset dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetLabel, setResetLabel] = useState(""); // descriptive label for dialog
  const [resetSublabel, setResetSublabel] = useState(""); // sub-label

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

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts, refreshKey]);

  // Open reset for an owner/provider account
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

  // Open reset for a police account
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

  // Filtering
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
    (activeTab === "owners" && filteredProviders.length === 0) ||
    (activeTab === "police" && filteredPolice.length === 0);

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Management</h1>
          <p className="text-sm text-muted-foreground">
            Reset username or password for owner and police accounts when requested.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        <button
          onClick={() => { setActiveTab("owners"); setSearch(""); }}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "owners"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Owners
          <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
            {providers.length}
          </Badge>
        </button>
        <button
          onClick={() => { setActiveTab("police"); setSearch(""); }}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "police"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-4 w-4" />
          Police
          <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px]">
            {policeUsers.length}
          </Badge>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={
            activeTab === "owners"
              ? "Search by provider, owner, phone, or username..."
              : "Search by name or username..."
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
              : activeTab === "owners"
                ? "Owner accounts will appear here when providers are registered."
                : "Police accounts will appear here once created by an operator."}
          </p>
        </div>
      ) : (
        activeTab === "owners" ? (
          /* ─── Owners Section ─── */
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
          /* ─── Police Section ─── */
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Username</th>
                    <th className="px-4 py-3 text-left font-semibold">Role</th>
                    <th className="px-4 py-3 text-left font-semibold">Created</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPolice.map((police) => (
                    <tr
                      key={police.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                            <Shield className="h-4 w-4 text-rose-600" />
                          </div>
                          <span className="font-medium">{police.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {police.username}
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">
                          POLICE
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(police.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openPoliceReset(police)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset Credentials
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {filteredPolice.map((police) => (
                <div
                  key={police.id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100">
                      <Shield className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{police.name}</p>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {police.username}
                      </code>
                    </div>
                    <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">
                      POLICE
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(police.createdAt).toLocaleDateString()}
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => openPoliceReset(police)}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset Credentials
                  </Button>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* Reset Credentials Dialog */}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetOpen(false)}
              >
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
    </div>
  );
}