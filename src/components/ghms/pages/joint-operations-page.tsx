"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Activity,
  Lock,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

import { useAppStore, type JointSessionInfo } from "@/lib/store";
import { apiJointStatus, apiJointLogout } from "@/lib/api";
import { req } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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

interface SystemStats {
  totalUsers: number;
  totalProviders: number;
  totalGuests: number;
  totalRooms: number;
  totalReservations: number;
}

/**
 * Joint Operations Page — accessible ONLY during an active joint session
 * (both SUPERUSER and Police ADMIN logged in simultaneously).
 *
 * This page provides elevated operations that require dual authorization:
 * - View system-wide statistics
 * - Emergency suspend all guesthouses
 * - Emergency unsuspend all guesthouses
 * - View all user accounts
 * - System audit review
 */
export default function JointOperationsPage() {
  const { currentUser, jointSession, setJointSession, setJointLoginDialogOpen } = useAppStore();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<any[] | null>(null);
  const [showUsers, setShowUsers] = useState(false);

  // Check joint session status on mount
  const refreshStatus = useCallback(async () => {
    try {
      const status = await apiJointStatus();
      setJointSession({
        active: status.active,
        superuser: status.superuser,
        policeAdmin: status.policeAdmin,
      });
    } catch {
      // Ignore
    }
  }, [setJointSession]);

  // Fetch system stats
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await req("/api/joint-ops/stats");
      setStats(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load stats";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    fetchStats();
  }, [refreshStatus, fetchStats]);

  // ── Emergency operations ──
  const handleEmergencyAction = async (action: string) => {
    try {
      setActioning(true);
      const data = await req("/api/joint-ops/emergency", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast.success(data.message || `Emergency ${action} completed.`);
      fetchStats(); // Refresh stats
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed: ${action}`;
      toast.error(message);
    } finally {
      setActioning(false);
      setConfirmAction(null);
    }
  };

  // ── Fetch all users ──
  const fetchAllUsers = async () => {
    try {
      const data = await req("/api/joint-ops/users");
      setAllUsers(data.users || []);
      setShowUsers(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      toast.error(message);
    }
  };

  // If no active joint session, show locked state
  if (!jointSession.active) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Lock className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Joint Operations Locked
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            This section requires both a System Admin (SUPERUSER) and a Police
            Admin to be logged in simultaneously on this device.
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Current session: {currentUser?.name} ({currentUser?.role})
          </p>
          <Button
            onClick={() => setJointLoginDialogOpen(true)}
            className="mt-6 gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            Start Joint Session
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            Joint Operations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Dual-authorized operations — requires both System Admin and Police Admin.
          </p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 px-3 py-1 text-xs font-semibold">
          <ShieldCheck className="mr-1 h-3 w-3" />
          JOINT SESSION ACTIVE
        </Badge>
      </div>

      {/* Joint session participants */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-emerald-600 font-medium">System Admin:</span>{" "}
            <span className="text-emerald-900 font-semibold">
              {jointSession.superuser?.name || "—"}
            </span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-emerald-300" />
          <div>
            <span className="text-emerald-600 font-medium">Police Admin:</span>{" "}
            <span className="text-emerald-900 font-semibold">
              {jointSession.policeAdmin?.name || "—"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-emerald-700 border-emerald-300 hover:bg-emerald-100"
            onClick={async () => {
              await apiJointLogout();
              setJointSession({ active: false, superuser: null, policeAdmin: null });
              toast.success("Joint session ended.");
            }}
          >
            <Unlock className="mr-1 h-3.5 w-3.5" />
            End Session
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Users
                </p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalUsers || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Guesthouses
                </p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalProviders || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Guests
                </p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalGuests || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Activity className="h-3 w-3" /> Rooms
                </p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalRooms || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Reservations
                </p>
                <p className="text-2xl font-bold text-slate-900">{stats?.totalReservations || 0}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Emergency Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-rose-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              Emergency Actions
            </CardTitle>
            <CardDescription>
              These actions require dual authorization. All actions are audit-logged.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              onClick={() => setConfirmAction("suspend-all")}
              disabled={actioning}
            >
              <Lock className="h-4 w-4" />
              Emergency Suspend All Guesthouses
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={() => setConfirmAction("unsuspend-all")}
              disabled={actioning}
            >
              <Unlock className="h-4 w-4" />
              Emergency Unsuspend All Guesthouses
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              System Intelligence
            </CardTitle>
            <CardDescription>
              View system-wide information for operational decisions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={fetchAllUsers}
              disabled={loading}
            >
              <Users className="h-4 w-4" />
              View All User Accounts
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* All Users Table (shown when requested) */}
      {showUsers && allUsers && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All User Accounts</CardTitle>
            <CardDescription>
              {allUsers.length} total users in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Username</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Role</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Rank</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u: any) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{u.username}</td>
                      <td className="px-4 py-2">{u.name}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            u.role === "SUPERUSER"
                              ? "bg-amber-100 text-amber-800 border-amber-200"
                              : u.role === "POLICE"
                              ? "bg-rose-100 text-rose-800 border-rose-200"
                              : u.role === "OPERATOR"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-sky-100 text-sky-800 border-sky-200"
                          }`}
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {u.policeRank || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-500 truncate max-w-[200px]">
                        {u.providerName || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirm Emergency Action
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "suspend-all" ? (
                <>
                  This will <strong>suspend ALL guesthouses</strong> in the system immediately.
                  No new check-ins will be allowed until manually unsuspended. This action
                  is performed under dual authorization of both{" "}
                  {jointSession.superuser?.name} and {jointSession.policeAdmin?.name}.
                </>
              ) : (
                <>
                  This will <strong>unsuspend ALL guesthouses</strong> in the system immediately.
                  All guesthouses will return to their previous status. This action is performed
                  under dual authorization of both {jointSession.superuser?.name} and{" "}
                  {jointSession.policeAdmin?.name}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actioning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => handleEmergencyAction(confirmAction || "")}
              disabled={actioning}
            >
              {actioning ? "Executing..." : "Confirm Action"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
