"use client";

import { useState, useRef, type FormEvent } from "react";
import { toast } from "sonner";
import { Building2, KeyRound, UserPlus, LogIn, Upload, MapPin, FileText } from "lucide-react";

import { useAppStore } from "@/lib/store";
import { apiAuth, apiRegisterProvider } from "@/lib/api";
import {
  BISHOFTU_SUBCITIES,
  getWoredas,
  composeBishoftuAddress,
} from "@/lib/bishoftu-admin-divisions";

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
import { Checkbox } from "@/components/ui/checkbox";
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
  const [regSubcity, setRegSubcity] = useState("");
  const [regWoreda, setRegWoreda] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regType, setRegType] = useState("");
  const [regLicenseNo, setRegLicenseNo] = useState("");
  const [regLicenseFile, setRegLicenseFile] = useState<File | null>(null);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regAgreed, setRegAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived: woredas for the selected sub-city
  const availableWoredas = regSubcity ? getWoredas(regSubcity) : [];

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
      const page = userData.role === "POLICE" ? "police-dashboard" : userData.role === "SUPERUSER" ? "super-admin-dashboard" : "dashboard";
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
      !regSubcity ||
      !regWoreda ||
      !regType ||
      !regLicenseNo.trim() ||
      !regUsername.trim() ||
      !regPassword.trim()
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!regAgreed) {
      toast.error("Please accept the Guest House Service Registration and Time Use Agreement to continue.");
      return;
    }
    setRegLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", regGuestHouseName.trim());   // backend 'name' = guest house name
      formData.append("ownerName", regName.trim());         // backend 'ownerName' = owner full name
      formData.append("phone", regPhone.trim());
      formData.append("email", regEmail.trim());
      // Compose a readable full address from the dropdowns + optional street detail
      const fullAddress = composeBishoftuAddress(regSubcity, regWoreda) + (regAddress.trim() ? `, ${regAddress.trim()}` : "");
      formData.append("address", fullAddress);
      formData.append("subcity", regSubcity);
      formData.append("woreda", regWoreda);
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
      setRegSubcity("");
      setRegWoreda("");
      setRegAddress("");
      setRegType("");
      setRegLicenseNo("");
      setRegUsername("");
      setRegPassword("");
      setRegAgreed(false);
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

                {/* Location — Bishoftu Address */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Location <span className="text-red-400">*</span>
                  </p>
                  <div className="grid gap-3">
                    {/* City (fixed) */}
                    <div className="grid gap-2">
                      <Label>City</Label>
                      <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-600">
                        <MapPin className="mr-2 size-3.5 text-emerald-500" />
                        Bishoftu
                      </div>
                    </div>

                    {/* Sub-city dropdown */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="reg-subcity">Sub-City *</Label>
                        <Select
                          value={regSubcity}
                          onValueChange={(val) => {
                            setRegSubcity(val);
                            setRegWoreda(""); // reset woreda when sub-city changes
                          }}
                        >
                          <SelectTrigger id="reg-subcity" className="w-full">
                            <SelectValue placeholder="Select sub-city" />
                          </SelectTrigger>
                          <SelectContent>
                            {BISHOFTU_SUBCITIES.map((sc) => (
                              <SelectItem key={sc.name} value={sc.name}>
                                {sc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Woreda dropdown (cascading) */}
                      <div className="grid gap-2">
                        <Label htmlFor="reg-woreda">Woreda *</Label>
                        <Select
                          value={regWoreda}
                          onValueChange={setRegWoreda}
                          disabled={!regSubcity}
                        >
                          <SelectTrigger id="reg-woreda" className="w-full">
                            <SelectValue
                              placeholder={regSubcity ? "Select woreda" : "Select sub-city first"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableWoredas.map((w) => (
                              <SelectItem key={w.name} value={w.name}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Street address (optional detail) */}
                    <div className="grid gap-2">
                      <Label htmlFor="reg-address">Street / Additional Detail</Label>
                      <Input
                        id="reg-address"
                        placeholder="House number, street name, landmark (optional)"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                      />
                    </div>
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

                {/* Agreement Acceptance */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="reg-agree"
                      checked={regAgreed}
                      onCheckedChange={(checked) => setRegAgreed(checked === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="reg-agree" className="text-sm leading-relaxed text-slate-600 cursor-pointer">
                      I have read and agree to the{" "}
                      <button
                        type="button"
                        onClick={() => setShowAgreement(true)}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800 hover:decoration-emerald-500"
                      >
                        <FileText className="size-3.5" />
                        Guest House Service Registration and Time Use Agreement
                      </button>
                    </Label>
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

                {/* Agreement Modal */}
                {showAgreement && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
                      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                        <h3 className="text-lg font-bold text-slate-900">Guest House Service Registration and Time Use Agreement</h3>
                        <button
                          type="button"
                          onClick={() => setShowAgreement(false)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                      <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: "calc(85vh - 140px)" }}>
                        <div className="prose prose-sm max-w-none text-slate-700">
                          <p className="mb-3"><strong>Article 1 — Definitions:</strong> "Platform" means the Guest House Management System. "Establishment" means your guest house. "Service Period" means your active subscription duration. "Trial Period" means the 15-day free access. "Grace Period" means 2 extra days after expiry for renewal.</p>
                          <p className="mb-3"><strong>Article 2 — Scope:</strong> The Platform provides room management, guest reservation and check-in/check-out tracking, guest registration, daytime service booking, expense tracking, housekeeping scheduling, and regulatory reporting. Minimum 95% uptime is guaranteed.</p>
                          <p className="mb-3"><strong>Article 3 — Registration:</strong> You must provide accurate business details and a valid license. Applications are reviewed by the regulatory authority. Rejected applications may be resubmitted within 30 days.</p>
                          <p className="mb-3"><strong>Article 4 — Subscription & Time of Use:</strong> After the 15-day trial, you must select a subscription cycle (Monthly, Quarterly, Semi-Annual, or Yearly) and pay the applicable fee. Renewal reminders are sent 7 days before expiry. Late renewal follows a phased restriction: Warning (7 days) > Grace (2 days) > Suspension.</p>
                          <p className="mb-3"><strong>Article 5 — Fees:</strong> Fees are in ETB. A 10% per-week late penalty may apply. Fee changes require 30 days notice.</p>
                          <p className="mb-3"><strong>Article 6 — Platform Operator Obligations:</strong> Maintain system availability, security, and technical support. Provide subscription status warnings.</p>
                          <p className="mb-3"><strong>Article 7 — Provider Obligations:</strong> Use the platform lawfully. Maintain a valid business license. Record all guest data accurately. Default check-in time is 14:00 and check-out time is 12:00.</p>
                          <p className="mb-3"><strong>Article 8 — Expiration & Suspension:</strong> Unrenewed subscriptions progress through Warning > Grace > full Suspension. Immediate suspension applies for unlawful use, license revocation, or regulatory directive. Data is deleted 90 days after permanent termination.</p>
                          <p className="mb-3"><strong>Article 9 — Data & Privacy:</strong> Guest data is processed per applicable law. No sharing except to regulatory authorities or by court order. Anonymized analytics may be used for platform improvement and police intelligence.</p>
                          <p className="mb-3"><strong>Article 10 — Liability:</strong> Downtime exceeding 2 months/month earns proportional credit. Total liability is capped at 12 months of fees. No consequential damages.</p>
                          <p className="mb-3"><strong>Article 11 — Force Majeure:</strong> Neither party is liable for events beyond reasonable control. 60+ day events allow termination without liability.</p>
                          <p className="mb-3"><strong>Article 12 — Intellectual Property:</strong> Platform IP belongs to the operator. You retain ownership of your operational data.</p>
                          <p className="mb-3"><strong>Article 13 — Confidentiality:</strong> Both parties must keep confidential information secret for 3 years after termination.</p>
                          <p className="mb-3"><strong>Article 14 — Dispute Resolution:</strong> Negotiation > Mediation > Court. Costs are shared equally during mediation.</p>
                          <p className="mb-3"><strong>Articles 15–16 — Notices & Miscellaneous:</strong> Written notices via email, mail, or platform. This is the entire agreement. Amendments require written consent. Governing law applies per jurisdiction.</p>
                        </div>
                      </div>
                      <div className="border-t border-slate-200 px-6 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setRegAgreed(true);
                            setShowAgreement(false);
                          }}
                          className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700"
                        >
                          I Agree & Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
