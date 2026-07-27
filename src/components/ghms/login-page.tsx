"use client";

import { useState, useRef, type FormEvent } from "react";
import { toast } from "sonner";
import { Building2, KeyRound, UserPlus, LogIn, Upload, MapPin, Loader2 } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { apiAuth, apiRegisterProvider } from "@/lib/api";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LoginPage() {
  const { setCurrentUser, setCurrentPage } = useAppStore();

  const [activeTab, setActiveTab] = useState("login");

  // ── Login state ──
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // ── Register state ──
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regGuestHouseName, setRegGuestHouseName] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regLatitude, setRegLatitude] = useState("");
  const [regLongitude, setRegLongitude] = useState("");
  const [regGeocoding, setRegGeocoding] = useState(false);
  const [regType, setRegType] = useState("");
  const [regLicenseNo, setRegLicenseNo] = useState("");
  const [regLicenseFile, setRegLicenseFile] = useState<File | null>(null);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Login handler ──
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      toast.error("Please enter both username and password.");
      return;
    }
    setLoginLoading(true);
    try {
      const resp = await apiAuth({
        username: loginUsername.trim(),
        password: loginPassword,
      });
      const userData = resp.user;
      setCurrentUser({ ...userData, providerName: resp.providerName });
      // Route based on role
      const page = userData.role === "POLICE" ? "police-dashboard" : userData.role === "SUPERUSER" ? "owner-accounts" : "dashboard";
      setCurrentPage(page);
      toast.success(`Welcome back, ${userData.name}!`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      toast.error(message);
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Register handler ──
  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (
      !regName.trim() ||
      !regPhone.trim() ||
      !regEmail.trim() ||
      !regGuestHouseName.trim() ||
      !regType ||
      !regLicenseNo.trim() ||
      !regUsername.trim() ||
      !regPassword.trim()
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setRegLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", regGuestHouseName.trim());   // backend 'name' = guest house name
      formData.append("ownerName", regName.trim());         // backend 'ownerName' = owner full name
      formData.append("phone", regPhone.trim());
      formData.append("email", regEmail.trim());
      if (regAddress.trim()) formData.append("address", regAddress.trim());
      if (regLatitude) formData.append("latitude", regLatitude);
      if (regLongitude) formData.append("longitude", regLongitude);
      formData.append("type", regType);
      formData.append("licenseNo", regLicenseNo.trim());
      formData.append("username", regUsername.trim());
      formData.append("password", regPassword);
      if (regLicenseFile) {
        formData.append("licenseFile", regLicenseFile);
      }

      await apiRegisterProvider(formData);
      toast.success(
        "Registration submitted successfully! An admin will review and activate your account."
      );
      // Reset form
      setRegName("");
      setRegPhone("");
      setRegEmail("");
      setRegGuestHouseName("");
      setRegAddress("");
      setRegLatitude("");
      setRegLongitude("");
      setRegType("");
      setRegLicenseNo("");
      setRegUsername("");
      setRegPassword("");
      setRegLicenseFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveTab("login");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setRegLoading(false);
    }
  }

  // ── Geocode handler (Nominatim — free, no API key) ──
  async function handleGeocode() {
    const query = regAddress.trim() || regGuestHouseName.trim();
    if (!query) {
      toast.error("Enter an address or guest house name to geocode.");
      return;
    }
    setRegGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Ethiopia")}&limit=1`,
        { headers: { "User-Agent": "GHMS-Registration/1.0" } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        setRegLatitude(data[0].lat);
        setRegLongitude(data[0].lon);
        toast.success(`Location found: ${data[0].display_name.split(",").slice(0, 2).join(",")}`);
      } else {
        toast.error("Could not find coordinates for this address. You can enter them manually.");
      }
    } catch {
      toast.error("Geocoding failed. Please enter coordinates manually.");
    } finally {
      setRegGeocoding(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
      {/* Subtle decorative blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/5 blur-3xl" />

      <Card className="relative z-10 w-full max-w-lg border-0 shadow-2xl">
        <CardHeader className="space-y-2 pb-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <Building2 className="size-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Guest House Management
          </CardTitle>
          <CardDescription className="text-slate-500">
            Sign in to your account or register a new guest house
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="login" className="gap-1.5">
                <LogIn className="size-3.5" />
                Login
              </TabsTrigger>
              <TabsTrigger value="register" className="gap-1.5">
                <UserPlus className="size-3.5" />
                Register
              </TabsTrigger>
            </TabsList>

            {/* ─── Login Tab ─── */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="login-username">Username</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="login-username"
                      placeholder="Enter your username"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="pl-9"
                      autoComplete="username"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-9"
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="mt-1 w-full bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700"
                  disabled={loginLoading}
                >
                  {loginLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ─── Register Tab ─── */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="grid gap-4">
                {/* Contact Information */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Contact Information
                  </p>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="reg-name">Full Name *</Label>
                      <Input
                        id="reg-name"
                        placeholder="Your full name"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="reg-phone">Phone *</Label>
                        <Input
                          id="reg-phone"
                          placeholder="Phone number"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="reg-email">Email *</Label>
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder="Email address"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guest House Details */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Guest House Details
                  </p>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="reg-gh-name">Guest House Name *</Label>
                      <Input
                        id="reg-gh-name"
                        placeholder="Name of your guest house"
                        value={regGuestHouseName}
                        onChange={(e) => setRegGuestHouseName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="reg-type">Type *</Label>
                        <Select value={regType} onValueChange={setRegType}>
                          <SelectTrigger id="reg-type" className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GUEST_HOUSE">
                              Guest House
                            </SelectItem>
                            <SelectItem value="HOTEL">Hotel</SelectItem>
                            <SelectItem value="LODGE">Lodge</SelectItem>
                            <SelectItem value="HOMESTAY">Homestay</SelectItem>
                            <SelectItem value="RESORT">Resort</SelectItem>
                            <SelectItem value="DHARAMSHALA">
                              Dharamshala
                            </SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="reg-license">License No. *</Label>
                        <Input
                          id="reg-license"
                          placeholder="License number"
                          value={regLicenseNo}
                          onChange={(e) => setRegLicenseNo(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reg-license-file">
                        Upload License Document
                      </Label>
                      <div
                        className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-3 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50"
                        onClick={() => fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            fileInputRef.current?.click();
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                          <Upload className="size-4 text-slate-500" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {regLicenseFile
                              ? regLicenseFile.name
                              : "Click to upload license document"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {regLicenseFile
                              ? `${(regLicenseFile.size / 1024).toFixed(1)} KB`
                              : "PDF, JPG, or PNG (max 5MB)"}
                          </p>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          if (file && file.size > 5 * 1024 * 1024) {
                            toast.error("File size must be under 5MB.");
                            return;
                          }
                          setRegLicenseFile(file);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Location (Optional) */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Location <span className="text-slate-400 font-normal normal-case">(optional)</span>
                  </p>
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="reg-address">Address</Label>
                      <Input
                        id="reg-address"
                        placeholder="Street address, city, or area"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="reg-lat">Latitude</Label>
                        <Input
                          id="reg-lat"
                          type="number"
                          step="any"
                          placeholder="e.g. 9.02"
                          value={regLatitude}
                          onChange={(e) => setRegLatitude(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="reg-lng">Longitude</Label>
                        <Input
                          id="reg-lng"
                          type="number"
                          step="any"
                          placeholder="e.g. 38.75"
                          value={regLongitude}
                          onChange={(e) => setRegLongitude(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGeocode}
                      disabled={regGeocoding}
                      className="w-full"
                    >
                      {regGeocoding ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" />
                          Geocoding...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <MapPin className="size-4" />
                          Geocode from Address / Name
                        </span>
                      )}
                    </Button>
                    <p className="text-[11px] text-slate-400">
                      Click the button above to auto-fill coordinates, or enter manually.
                    </p>
                  </div>
                </div>

                {/* Login Credentials */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Desired Login Credentials
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="reg-username">Username *</Label>
                      <Input
                        id="reg-username"
                        placeholder="Desired username"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reg-password">Password *</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder="Password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="mt-1 w-full bg-gradient-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700"
                  disabled={regLoading}
                >
                  {regLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Submitting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <UserPlus className="size-4" />
                      Register Guest House
                    </span>
                  )}
                </Button>

                <p className="text-center text-xs text-slate-400">
                  Your registration will be reviewed by an administrator before
                  activation.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}