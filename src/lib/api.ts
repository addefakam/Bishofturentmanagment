import { useAppStore } from "./store";

function headers(): Record<string, string> {
  const user = useAppStore.getState().currentUser;
  return {
    "Content-Type": "application/json",
    ...(user
      ? {
          "x-user-role": user.role,
          "x-provider-id": user.providerId || "",
          "x-user-permissions": JSON.stringify(user.permissions),
        }
      : {}),
  };
}

async function req(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { ...opts, headers: { ...headers(), ...opts.headers } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Auth
export const apiAuth = (data: { username: string; password: string }) =>
  req("/api/auth", { method: "POST", body: JSON.stringify(data) });

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
  const res = await fetch("/api/providers", { method: "POST", body: data });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Registration failed: ${res.status}`);
  }
  return json;
};

// Police
export const apiPoliceDashboard = () => req("/api/police-dashboard");
export const apiPoliceGuests = (q?: string) => req(`/api/police-guests${q ? `?${q}` : ""}`);

// Suspected Persons (Police only)
export const apiGetSuspectedPersons = (q?: string) => req(`/api/suspected-persons${q ? `?${q}` : ""}`);
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
export const apiPoliceGuestLinking = () => req("/api/police-intelligence/linking");
export const apiPoliceAuditLogs = (q?: string) => req(`/api/police-audit${q ? `?${q}` : ""}`);
export const apiPoliceGeofences = () => req("/api/police-geofences");
export const apiPoliceCreateGeofence = (data: Record<string, unknown>) => req("/api/police-geofences", { method: "POST", body: JSON.stringify(data) });
export const apiPoliceDeleteGeofence = (id: string) => req(`/api/police-geofences?id=${id}`, { method: "DELETE" });
export const apiPoliceAlertConfig = () => req("/api/police-alert-config");
export const apiPoliceUpdateAlertConfig = (data: Record<string, unknown>) => req("/api/police-alert-config", { method: "PUT", body: JSON.stringify(data) });
export const apiPoliceExport = (q: string) => req(`/api/police-export?${q}`);