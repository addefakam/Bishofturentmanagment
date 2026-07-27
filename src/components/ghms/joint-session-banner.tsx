"use client";

import { useEffect, useCallback } from "react";
import { ShieldCheck, X, LogOut } from "lucide-react";
import { toast } from "sonner";

import { useAppStore } from "@/lib/store";
import { apiJointStatus, apiJointLogout } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * JointSessionBanner — shown at the top of the app when a joint session is active.
 * Also polls /api/auth/joint-status periodically to detect session expiry.
 */
export default function JointSessionBanner() {
  const { currentUser, jointSession, setJointSession, setJointLoginDialogOpen } =
    useAppStore();

  const isSuperuserOrPoliceAdmin =
    currentUser?.role === "SUPERUSER" ||
    (currentUser?.role === "POLICE" && currentUser?.policeRank === "ADMIN");

  // Poll joint status every 30 seconds
  const refreshStatus = useCallback(async () => {
    try {
      const status = await apiJointStatus();
      setJointSession({
        active: status.active,
        superuser: status.superuser,
        policeAdmin: status.policeAdmin,
      });
      // If was active and now not, notify
      if (jointSession.active && !status.active) {
        toast.info("Joint session has ended.");
      }
    } catch {
      // Silently ignore — will retry on next poll
    }
  }, [setJointSession, jointSession.active]);

  useEffect(() => {
    // Check joint status on mount (if superuser or police admin)
    if (isSuperuserOrPoliceAdmin && currentUser) {
      refreshStatus();
      const interval = setInterval(refreshStatus, 30000); // every 30s
      return () => clearInterval(interval);
    }
  }, [isSuperuserOrPoliceAdmin, currentUser, refreshStatus]);

  const handleEndJoint = async () => {
    try {
      await apiJointLogout();
      setJointSession({ active: false, superuser: null, policeAdmin: null });
      toast.success("Joint session ended.");
    } catch {
      toast.error("Failed to end joint session.");
    }
  };

  // Only show banner when joint session is active
  if (!jointSession.active) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">
            Joint Session Active
          </p>
          <p className="truncate text-xs text-emerald-700">
            {jointSession.superuser?.name} (System Admin) +{" "}
            {jointSession.policeAdmin?.name} (Police Admin)
          </p>
        </div>
        <Badge className="shrink-0 bg-emerald-600 text-white text-[10px]">
          ELEVATED
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleEndJoint}
        className="shrink-0 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
      >
        <LogOut className="mr-1 h-3.5 w-3.5" />
        End Joint
      </Button>
    </div>
  );
}
