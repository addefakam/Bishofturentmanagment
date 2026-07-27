"use client";

import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { JointLoginDialog } from "@/components/ghms/joint-login-dialog";
import JointSessionBanner from "@/components/ghms/joint-session-banner";

// ── Loading fallback ──
function PageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary/60" />
        <p className="text-sm font-medium text-slate-400">Loading page...</p>
      </div>
    </div>
  );
}

// ── Fallback for missing pages ──
function PageNotFound({ page }: { page: string }) {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <span className="text-2xl font-bold text-slate-300">?</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-700">Page Not Found</h2>
        <p className="mt-1 text-sm text-slate-400">
          The page &quot;{page}&quot; has not been implemented yet.
        </p>
      </div>
    </div>
  );
}

// ── Lazy-loaded page components ──
const lazyPage = (importFn: () => Promise<{ default: React.ComponentType }>) =>
  lazy(importFn);

const DashboardPage = lazyPage(
  () => import("@/components/ghms/pages/dashboard-page")
);
const RoomsPage = lazyPage(() => import("@/components/ghms/pages/rooms-page"));
const GuestsPage = lazyPage(() => import("@/components/ghms/pages/guests-page"));
const ReservationsPage = lazyPage(
  () => import("@/components/ghms/pages/reservations-page")
);
const GuestsReservationsPage = lazyPage(
  () => import("@/components/ghms/pages/guests-reservations-page")
);
const DaytimePage = lazyPage(
  () => import("@/components/ghms/pages/daytime-page")
);
const ExpensesPage = lazyPage(
  () => import("@/components/ghms/pages/expenses-page")
);
const ResourcesPage = lazyPage(
  () => import("@/components/ghms/pages/resources-page")
);
const HousekeepingPage = lazyPage(
  () => import("@/components/ghms/pages/housekeeping-page")
);
// Users page is now handled by OwnerAccountsPage (unified User Management)
const ReportsPage = lazyPage(
  () => import("@/components/ghms/pages/reports-page")
);
const SettingsPage = lazyPage(
  () => import("@/components/ghms/pages/settings-page")
);
const NotificationsPage = lazyPage(
  () => import("@/components/ghms/pages/notifications-page")
);
const ProvidersPage = lazyPage(
  () => import("@/components/ghms/pages/providers-page")
);
const PoliceDashboardPage = lazyPage(
  () => import("@/components/ghms/pages/police-dashboard-page")
);
const PoliceGuestsPage = lazyPage(
  () => import("@/components/ghms/pages/police-guests-page")
);
const SuspectAlertsPage = lazyPage(
  () => import("@/components/ghms/pages/suspect-alerts-page")
);
const SuspectedPersonsPage = lazyPage(
  () => import("@/components/ghms/pages/suspected-persons-page")
);
const PoliceIntelligencePage = lazyPage(
  () => import("@/components/ghms/pages/police-intelligence-page")
);
const PoliceInvestigationPage = lazyPage(
  () => import("@/components/ghms/pages/police-investigation-page")
);
const PoliceSecurityPage = lazyPage(
  () => import("@/components/ghms/pages/police-security-page")
);
const ReviewsPage = lazyPage(
  () => import("@/components/ghms/pages/reviews-page")
);
const OwnerAccountsPage = lazyPage(
  () => import("@/components/ghms/pages/owner-accounts-page")
);
const JointOperationsPage = lazyPage(
  () => import("@/components/ghms/pages/joint-operations-page")
);

// ── Page registry: maps page key → lazy component ──
const PAGE_MAP: Record<string, React.LazyExoticComponent<React.ComponentType>> =
  {
    dashboard: DashboardPage,
    rooms: RoomsPage,
    "guests-reservations": GuestsReservationsPage,
    guests: GuestsPage,             // keep for direct links / staff permissions
    reservations: ReservationsPage, // keep for direct links / staff permissions
    daytime: DaytimePage,
    expenses: ExpensesPage,
    resources: ResourcesPage,
    housekeeping: HousekeepingPage,
    users: OwnerAccountsPage,
    reports: ReportsPage,
    settings: SettingsPage,
    notifications: NotificationsPage,
    providers: ProvidersPage,
    "police-dashboard": PoliceDashboardPage,
    "police-guests": PoliceGuestsPage,
    "suspect-alerts": SuspectAlertsPage,
    "suspected-persons": SuspectedPersonsPage,
    "police-intelligence": PoliceIntelligencePage,
    "police-investigation": PoliceInvestigationPage,
    "police-security": PoliceSecurityPage,
    reviews: ReviewsPage,
    "owner-accounts": OwnerAccountsPage,
    "joint-operations": JointOperationsPage,
  };

// ── Page Renderer ──
export default function PageRenderer() {
  const currentPage = useAppStore((s) => s.currentPage);
  const jointLoginDialogOpen = useAppStore((s) => s.jointLoginDialogOpen);
  const setJointLoginDialogOpen = useAppStore((s) => s.setJointLoginDialogOpen);

  // If on the login page, don't render anything here — LoginPage handles its own layout
  if (currentPage === "login") return null;

  const PageComponent = PAGE_MAP[currentPage];

  if (!PageComponent) {
    return <PageNotFound page={currentPage} />;
  }

  return (
    <>
      <JointSessionBanner />
      <Suspense fallback={<PageLoader />}>
        <PageComponent />
      </Suspense>
      <JointLoginDialog
        open={jointLoginDialogOpen}
        onOpenChange={setJointLoginDialogOpen}
      />
    </>
  );
}