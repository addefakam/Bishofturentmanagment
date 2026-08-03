import { useAppStore } from "./store";

export function getHeaders(): Record<string, string> {
  const user = useAppStore.getState().currentUser;
  return {
    "Content-Type": "application/json",
    // Headers are now just for backward compat — server reads JWT from cookie
    ...(user
      ? {
          "x-user-role": user.role,
          "x-provider-id": user.providerId || "",
          "x-user-permissions": JSON.stringify(user.permissions),
          "x-user-police-rank": user.policeRank || "",
          "x-user-name": user.name || "",
        }
      : {}),
  };
}

export async function req(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...getHeaders(), ...opts.headers },
    credentials: "include", // Always include cookies (JWT httpOnly)
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    // Try to extract a clean error message from JSON response
    try {
      const j = JSON.parse(t);
      if (j.error) throw new Error(j.error);
      if (j.message) throw new Error(j.message);
    } catch (e) {
      if (e instanceof Error && e.message !== t) throw e; // Re-throw our extracted error
    }
    throw new Error(t || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Auth
export const apiAuth = (data: { username: string; password: string }) =>
  req("/api/auth", { method: "POST", body: JSON.stringify(data) });

// Logout — calls server to clear httpOnly cookie
export const apiLogout = async () => {
  try {
    await fetch("/api/auth", {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // Ignore logout errors
  }
};

// ── Joint Session (Concurrent Dual Session) ──
export const apiJointLogin = (data: { username: string; password: string }) =>
  req("/api/auth/joint-login", { method: "POST", body: JSON.stringify(data) });

export const apiJointStatus = () =>
  req("/api/auth/joint-status");

export const apiJointLogout = async () => {
  try {
    await fetch("/api/auth/joint-logout", {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // Ignore errors
  }
};

// Dashboard
export const apiDashboard = () => req("/api/dashboard");

// Rooms
export const apiGetRooms = (q?: string) => req(`/api/rooms${q ? `?q=${q}` : ""}`);
export const apiCreateRoom = (data: Record<string, unknown>) =>
  req("/api/rooms", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateRoom = (id: string, data: Record<string, unknown>) =>
  req(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteRoom = (id: string) =>
  req(`/api/rooms/${id}`, { method: "DELETE" });
export const apiUpdateRoomStatus = (id: string, status: string) =>
  req(`/api/rooms/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
export const apiImportRooms = (rooms: Record<string, unknown>[]) =>
  req("/api/rooms", { method: "POST", body: JSON.stringify({ bulk: rooms }) });

// Guests
export const apiGetGuests = (q?: string) => req(`/api/guests${q ? `?q=${q}` : ""}`);
export const apiCreateGuest = (data: Record<string, unknown>) =>
  req("/api/guests", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateGuest = (id: string, data: Record<string, unknown>) =>
  req(`/api/guests/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteGuest = (id: string) =>
  req(`/api/guests/${id}`, { method: "DELETE" });

// Reservations
export const apiGetReservations = (q?: string) => req(`/api/reservations${q ? `?${q}` : ""}`);
export const apiCreateReservation = (data: Record<string, unknown>) =>
  req("/api/reservations", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateReservation = (id: string, data: Record<string, unknown>) =>
  req(`/api/reservations/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteReservation = (id: string) =>
  req(`/api/reservations/${id}`, { method: "DELETE" });
export const apiCheckin = (id: string) =>
  req(`/api/reservations/${id}/checkin`, { method: "POST" });
export const apiCheckout = (id: string, data?: Record<string, unknown>) =>
  req(`/api/reservations/${id}/checkout`, { method: "POST", body: JSON.stringify(data || {}) });
export const apiCancelReservation = (id: string) =>
  req(`/api/reservations/${id}/cancel`, { method: "POST" });

// Payments
export const apiCreatePayment = (data: Record<string, unknown>) =>
  req("/api/payments", { method: "POST", body: JSON.stringify(data) });

// Expenses
export const apiGetExpenses = (q?: string) => req(`/api/expenses${q ? `?${q}` : ""}`);
export const apiCreateExpense = (data: Record<string, unknown>) =>
  req("/api/expenses", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateExpense = (id: string, data: Record<string, unknown>) =>
  req(`/api/expenses/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteExpense = (id: string) =>
  req(`/api/expenses/${id}`, { method: "DELETE" });

// Expense Categories
export const apiGetExpenseCategories = () => req("/api/expense-categories");
export const apiCreateExpenseCategory = (data: Record<string, unknown>) =>
  req("/api/expense-categories", { method: "POST", body: JSON.stringify(data) });
export const apiDeleteExpenseCategory = (id: string) =>
  req(`/api/expense-categories/${id}`, { method: "DELETE" });

// Resources
export const apiGetResources = (q?: string) => req(`/api/resources${q ? `?q=${q}` : ""}`);
export const apiCreateResource = (data: Record<string, unknown>) =>
  req("/api/resources", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateResource = (id: string, data: Record<string, unknown>) =>
  req(`/api/resources/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteResource = (id: string) =>
  req(`/api/resources/${id}`, { method: "DELETE" });
export const apiRestockResource = (id: string, qty: number) =>
  req(`/api/resources/${id}/restock`, { method: "POST", body: JSON.stringify({ quantity: qty }) });

// Housekeeping
export const apiGetHousekeeping = (q?: string) => req(`/api/housekeeping${q ? `?${q}` : ""}`);
export const apiCreateHousekeeping = (data: Record<string, unknown>) =>
  req("/api/housekeeping", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateHousekeeping = (id: string, data: Record<string, unknown>) =>
  req(`/api/housekeeping/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteHousekeeping = (id: string) =>
  req(`/api/housekeeping/${id}`, { method: "DELETE" });

// Users
export const apiGetUsers = () => req("/api/users");
export const apiCreateUser = (data: Record<string, unknown>) =>
  req("/api/users", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateUser = (id: string, data: Record<string, unknown>) =>
  req(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteUser = (id: string) =>
  req(`/api/users/${id}`, { method: "DELETE" });

// Settings
export const apiGetSettings = () => req("/api/settings");
export const apiUpdateSettings = (data: Record<string, unknown>) =>
  req("/api/settings", { method: "PUT", body: JSON.stringify(data) });

// Notifications
export const apiGetNotifications = () => req("/api/notifications");
export const apiCreateNotification = (data: Record<string, unknown>) =>
  req("/api/notifications", { method: "POST", body: JSON.stringify(data) });
export const apiMarkNotificationRead = (id: string) =>
  req(`/api/notifications/${id}`, { method: "PUT", body: JSON.stringify({ isRead: true }) });

// Activity
export const apiGetActivity = () => req("/api/activity");

// Reports
export const apiGetReports = (q?: string) => req(`/api/reports${q ? `?${q}` : ""}`);

// Data export/import
export const apiExportData = () => req("/api/data");
export const apiImportData = (data: Record<string, unknown>) =>
  req("/api/data", { method: "POST", body: JSON.stringify(data) });

// Providers (Police)
export const apiGetProviders = () => req("/api/providers");
export const apiUpdateProvider = (id: string, data: Record<string, unknown>) =>
  req(`/api/providers/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiRegisterProvider = async (data: FormData) => {
  const res = await fetch("/api/providers", { method: "POST", body: data, credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Registration failed: ${res.status}`);
  }
  return json;
};

// Police
export const apiPoliceDashboard = () => req("/api/police-dashboard");
export const apiPoliceGuests = (params?: { q?: string; page?: number; pageSize?: number }) => {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return req(`/api/police-guests${qs ? `?${qs}` : ""}`);
};
export const apiPoliceOfficers = () => req("/api/police-officers");
export const apiPoliceCreateOfficer = (data: Record<string, unknown>) =>
  req("/api/police-officers", { method: "POST", body: JSON.stringify(data) });
export const apiPoliceUpdateOfficer = (data: Record<string, unknown>) =>
  req("/api/police-officers", { method: "PUT", body: JSON.stringify(data) });
export const apiPoliceDeleteOfficer = (id: string) =>
  req(`/api/police-officers?id=${id}`, { method: "DELETE" });

// Suspected Persons (Police only)
export const apiGetSuspectedPersons = (params?: { q?: string; severity?: string; active?: string; page?: number; pageSize?: number }) => {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.severity) sp.set("severity", params.severity);
  if (params?.active !== undefined) sp.set("active", params.active);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return req(`/api/suspected-persons${qs ? `?${qs}` : ""}`);
};
export const apiCreateSuspectedPerson = (data: Record<string, unknown>) =>
  req("/api/suspected-persons", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateSuspectedPerson = (id: string, data: Record<string, unknown>) =>
  req(`/api/suspected-persons/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteSuspectedPerson = (id: string) =>
  req(`/api/suspected-persons/${id}`, { method: "DELETE" });

// Suspect Matches / Alerts (Police only)
export const apiGetSuspectMatches = (q?: string) => req(`/api/suspect-matches${q ? `?${q}` : ""}`);
export const apiMarkMatchesRead = (data: Record<string, unknown>) =>
  req("/api/suspect-matches", { method: "PUT", body: JSON.stringify(data) });

// Daytime
export const apiGetDaytimeServices = () => req("/api/daytime-services");
export const apiCreateDaytimeService = (data: Record<string, unknown>) =>
  req("/api/daytime-services", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateDaytimeService = (id: string, data: Record<string, unknown>) =>
  req(`/api/daytime-services/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteDaytimeService = (id: string) =>
  req(`/api/daytime-services/${id}`, { method: "DELETE" });
export const apiGetDaytimeBookings = (q?: string) => req(`/api/daytime-bookings${q ? `?${q}` : ""}`);
export const apiCreateDaytimeBooking = (data: Record<string, unknown>) =>
  req("/api/daytime-bookings", { method: "POST", body: JSON.stringify(data) });
export const apiUpdateDaytimeBooking = (id: string, data: Record<string, unknown>) =>
  req(`/api/daytime-bookings/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeleteDaytimeBooking = (id: string) =>
  req(`/api/daytime-bookings/${id}`, { method: "DELETE" });

// Reviews
export const apiGetReviews = (q?: string) => req(`/api/reviews${q ? `?${q}` : ""}`);
export const apiCreateReview = (data: Record<string, unknown>) =>
  req("/api/reviews", { method: "POST", body: JSON.stringify(data) });
export const apiDeleteReview = (id: string) =>
  req(`/api/reviews/${id}`, { method: "DELETE" });

// Owner Accounts (SUPERUSER: manage provider/owner credentials only)
export const apiGetOwnerAccounts = () => req("/api/owner-accounts");
export const apiUpdateOwnerAccount = (id: string, data: Record<string, unknown>) =>
  req(`/api/owner-accounts/${id}`, { method: "PUT", body: JSON.stringify(data) });

// Police Intelligence & Investigation
export const apiPoliceIntelligence = () => req("/api/police-intelligence");
export const apiPoliceMovement = (q: string) => req(`/api/police-intelligence/movement?${q}`);
export const apiPoliceFrequentStays = (q?: string) => req(`/api/police-intelligence/frequent-stays${q ? `?${q}` : ""}`);
export const apiPoliceTriggerFrequentAnalysis = () => req("/api/police-intelligence/frequent-stays", { method: "POST" });
export const apiPoliceGuestLinking = (params?: { page?: number; pageSize?: number }) => {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return req(`/api/police-intelligence/linking${qs ? `?${qs}` : ""}`);
};
export const apiPoliceAuditLogs = (q?: string) => req(`/api/police-audit${q ? `?${q}` : ""}`);
export const apiPoliceGeofences = () => req("/api/police-geofences");
export const apiPoliceCreateGeofence = (data: Record<string, unknown>) => req("/api/police-geofences", { method: "POST", body: JSON.stringify(data) });
export const apiPoliceDeleteGeofence = (id: string) => req(`/api/police-geofences?id=${id}`, { method: "DELETE" });
export const apiPoliceAlertConfig = () => req("/api/police-alert-config");
export const apiPoliceUpdateAlertConfig = (data: Record<string, unknown>) => req("/api/police-alert-config", { method: "PUT", body: JSON.stringify(data) });
export const apiPoliceExport = (q: string) => req(`/api/police-export?${q}`);

// Police Report (HTML)
export const apiPoliceReport = (month: number, year: number) =>
  fetch(`/api/police-report?month=${month}&year=${year}`, { headers: { ...getHeaders() }, credentials: "include" }).then(async (res) => {
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `Report generation failed: ${res.status}`);
    }
    return res.text();
  });

// Geocoding
export const apiGeocodeAddress = (address: string) => req(`/api/geocode?address=${encodeURIComponent(address)}`);
export const apiGeocodeBatch = () => req("/api/geocode", { method: "POST" });

// ── Subscriptions (SUPERUSER) ──
export const apiGetSubscriptions = (statusFilter?: string) =>
  req(`/api/subscriptions${statusFilter ? `?status=${statusFilter}` : ""}`);
export const apiUpdateSubscription = (id: string, data: Record<string, unknown>) =>
  req(`/api/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiMarkPayment = (id: string, data: Record<string, unknown>) =>
  req(`/api/subscriptions/${id}/pay`, { method: "POST", body: JSON.stringify(data) });
export const apiGetSubscriptionPayments = (subscriptionId: string) =>
  req(`/api/subscriptions/payments?subscriptionId=${subscriptionId}`);

// Subscription status (provider side)
export const apiSubscriptionStatus = () => req("/api/subscription/status");

// Subscription Plans (SUPERUSER)
export const apiGetPlans = () => req("/api/subscription-plans");
export const apiCreatePlan = (data: { name: string; cycle: string; price: number }) =>
  req("/api/subscription-plans", { method: "POST", body: JSON.stringify(data) });
export const apiUpdatePlan = (id: string, data: Record<string, unknown>) =>
  req(`/api/subscription-plans/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiDeletePlan = (id: string) =>
  req(`/api/subscription-plans/${id}`, { method: "DELETE" });

// Anomalies (Smart Detection)
export const apiGetAnomalies = (q?: string) => req(`/api/anomalies${q ? `?${q}` : ""}`);
export const apiReviewAnomalies = (ids: string[]) =>
  req("/api/anomalies", { method: "POST", body: JSON.stringify({ action: "review", ids }) });
export const apiTriggerAnomalyScan = () =>
  req("/api/anomalies", { method: "POST", body: JSON.stringify({ action: "scan" }) });
export const apiToggleAnomalyDetection = (enabled: boolean) =>
  req("/api/anomalies", { method: "POST", body: JSON.stringify({ action: "toggle", enabled }) });

// Police room availability (city-wide)
export const apiPoliceRoomAvailability = () => req("/api/police-room-availability");

// Police suspend provider (with reason + notification to provider)
export const apiPoliceSuspendProvider = (data: Record<string, unknown>) =>
  req("/api/police-suspend-provider", { method: "POST", body: JSON.stringify(data) });

// ── Superuser User Management ──
export const apiSuperGetUsers = (params?: {
  search?: string;
  role?: string;
  providerId?: string;
  page?: number;
  pageSize?: number;
}) => {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.role) sp.set("role", params.role);
  if (params?.providerId) sp.set("providerId", params.providerId);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.pageSize) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return req(`/api/superuser/users${qs ? `?${qs}` : ""}`);
};
export const apiSuperGetUser = (id: string) =>
  req(`/api/superuser/users/${id}`);
export const apiSuperCreateUser = (data: Record<string, unknown>) =>
  req("/api/superuser/users", { method: "POST", body: JSON.stringify(data) });
export const apiSuperUpdateUser = (id: string, data: Record<string, unknown>) =>
  req(`/api/superuser/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const apiSuperDeleteUser = (id: string) =>
  req(`/api/superuser/users/${id}`, { method: "DELETE" });

// ── Superuser Profile ──
export const apiSuperGetProfile = () =>
  req("/api/superuser/users");
export const apiSuperUpdateProfile = (id: string, data: Record<string, unknown>) =>
  req(`/api/superuser/users/${id}`, { method: "PUT", body: JSON.stringify(data) });

// ── Superuser: list providers for dropdown ──
export const apiSuperGetProviders = () =>
  req("/api/providers");

// ── Superuser: create guesthouse (auto-approved) ──
export const apiSuperCreateProvider = (data: Record<string, unknown>) =>
  req("/api/providers", { method: "POST", body: JSON.stringify(data) });
