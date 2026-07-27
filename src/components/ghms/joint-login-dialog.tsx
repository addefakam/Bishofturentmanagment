"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

import { useAppStore, type CurrentUser } from "@/lib/store";
import { apiJointLogin, apiJointStatus, apiJointLogout } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function JointLoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { currentUser, jointSession, setJointSession } = useAppStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Determine which role the primary user is
  const isPrimarySuperuser = currentUser?.role === "SUPERUSER";
  const neededRole = isPrimarySuperuser
    ? "Police ADMIN"
    : "SUPERUSER (System Admin)";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const resp = await apiJointLogin({
        username: username.trim(),
        password: password.trim(),
      });
      // Refresh joint status
      const status = await apiJointStatus();
      setJointSession({
        active: true,
        superuser: status.superuser,
        policeAdmin: status.policeAdmin,
      });
      setUsername("");
      setPassword("");
      onOpenChange(false);
      toast.success(
        `Joint session activated! ${resp.primaryUser.name} + ${resp.jointUser.name}`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start joint session";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" />
            Start Joint Session
          </DialogTitle>
          <DialogDescription>
            Two-factor authorization requires both a System Admin and a Police
            Admin to be active simultaneously. You are currently logged in as{" "}
            <strong>{currentUser?.name}</strong>{" "}
            ({isPrimarySuperuser ? "SUPERUSER" : currentUser?.policeRank || "POLICE"}).
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">
                Please ask the {neededRole} to enter their credentials.
              </p>
              <p className="mt-1 text-amber-700">
                Both sessions will remain active until either user logs out.
                All joint actions are audit-logged.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="joint-username">
              {neededRole} Username
            </Label>
            <Input
              id="joint-username"
              placeholder={`Enter ${neededRole.toLowerCase()} username`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="joint-password">
              {neededRole} Password
            </Label>
            <Input
              id="joint-password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !username.trim() || !password.trim()}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {loading ? "Verifying..." : "Activate Joint Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
