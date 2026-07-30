"use client";

import React, { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Bed,
  BedDouble,
  Users,
  CalendarCheck,
  Sun,
  Receipt,
  Package,
  Sparkles,
  UserCog,
  BarChart3,
  Settings,
  Bell,
  Building2,
  Search,
  Shield,
  Star,
  ChevronLeft,
  Menu,
  UsersRound,
  ShieldAlert,
  UserX,
  ScanLine,
  CreditCard,
  ShieldCheck,
  Clock,
  AlertTriangle,
  UserCircle,
  ChevronDown,
  LogOut,
  BrainCircuit,
} from "lucide-react";

import { useAppStore, type CurrentUser } from "@/lib/store";
import { formatDaysRemaining, formatCycle } from "@/lib/subscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { POLICE_RANK_PERMISSIONS, RANK_LABELS, RANK_BADGE_CLASSES, type PoliceRank } from "@/lib/police-permissions";
import { apiLogout } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Navigation item definition ──
interface NavItem {
  page: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

// ── All available navigation items ──
const ALL_NAV_ITEMS: NavItem[] = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "rooms", label: "Rooms", icon: Bed },
  { page: "daytime", label: "Daytime", icon: Sun },
  { page: "expenses", label: "Expenses", icon: Receipt },
  { page: "resources", label: "Resources", icon: Package },
  { page: "housekeeping", label: "Housekeeping", icon: Sparkles },
  { page: "users", label: "Users", icon: UserCog },
  { page: "reports", label: "Reports", icon: BarChart3 },
  { page: "settings", label: "Settings", icon: Settings },
  { page: "notifications", label: "Notifications", icon: Bell, badge: "new" },
];

const POLICE_NAV_ITEMS: NavItem[] = [
  {
    page: "police-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  { page: "providers", label: "Providers", icon: Building2 },
  {
    page: "police-room-availability",
    label: "Room Availability",
    icon: BedDouble,
  },
  {
    page: "police-guests",
    label: "Guests Search",
    icon: Search,
  },
  {
    page: "suspect-alerts",
    label: "Suspect Alerts",
    icon: ShieldAlert,
    badge: "new",
  },
  {
    page: "suspected-persons",
    label: "Suspected Persons",
    icon: UserX,
  },
  {
    page: "police-investigation",
    label: "Investigation & Settings",
    icon: Search,
  },
  {
    page: "police-security",
    label: "Security",
    icon: Shield,
  },
  {
    page: "anomaly-detection",
    label: "Anomaly Detection",
    icon: BrainCircuit,
  },
  {
    page: "owner-accounts",
    label: "Manage Officers",
    icon: UserCog,
  },
  {
    page: "notifications",
    label: "Notifications",
    icon: Bell,
    badge: "new",
  },
];

// SUPERUSER (admin): police admin management, guesthouse management, subscriptions, settings, notifications (no dashboard)
const SUPERUSER_NAV_ITEMS: NavItem[] = [
  { page: "owner-accounts", label: "Police Admins", icon: Shield },
  { page: "providers", label: "Guesthouses", icon: Building2 },
  { page: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { page: "notifications", label: "Notifications", icon: Bell },
];

const OPERATOR_EXCLUDED = new Set<string>(["owner-accounts"]);

// ── Permission → page mapping for STAFF role ──
// Supports both legacy keys (rooms, daytime) and new keys (rooms_view, daytime_view)
const PERMISSION_PAGE_MAP: Record<string, NavItem> = {
  // New keys with _view suffix
  rooms_view: { page: "rooms", label: "Rooms", icon: Bed },
  daytime_view: { page: "daytime", label: "Daytime", icon: Sun },
  housekeeping_view: {
    page: "housekeeping",
    label: "Housekeeping",
    icon: Sparkles,
  },
  reports_view: { page: "reports", label: "Reports", icon: BarChart3 },
  reviews_view: { page: "reviews", label: "Reviews", icon: Star },
  notifications_view: {
    page: "notifications",
    label: "Notifications",
    icon: Bell,
  },
  settings_view: { page: "settings", label: "Settings", icon: Settings },
  // Legacy keys without _view suffix (backward compat)
  rooms: { page: "rooms", label: "Rooms", icon: Bed },
  daytime: { page: "daytime", label: "Daytime", icon: Sun },
  housekeeping: {
    page: "housekeeping",
    label: "Housekeeping",
    icon: Sparkles,
  },
  reports: { page: "reports", label: "Reports", icon: BarChart3 },
  reviews: { page: "reviews", label: "Reviews", icon: Star },
  notifications: {
    page: "notifications",
    label: "Notifications",
    icon: Bell,
  },
  settings: { page: "settings", label: "Settings", icon: Settings },
  reservations: { page: "guests-reservations", label: "Reservations", icon: CalendarCheck },
  guests: { page: "guests-reservations", label: "Guests", icon: UsersRound },
};

// ── Helper: get nav items based on role ──
function getNavItems(user: CurrentUser): NavItem[] {
  switch (user.role) {
    case "POLICE": {
      const rank = (user.policeRank || "OFFICER") as PoliceRank;
      const allowedPages = POLICE_RANK_PERMISSIONS[rank] || POLICE_RANK_PERMISSIONS.OFFICER;
      return POLICE_NAV_ITEMS.filter((item) => allowedPages.includes(item.page));
    }

    case "SUPERUSER":
      return SUPERUSER_NAV_ITEMS;

    case "OPERATOR":
      return ALL_NAV_ITEMS.filter((item) => !OPERATOR_EXCLUDED.has(item.page));

    case "STAFF": {
      const items: NavItem[] = [];
      // Always give staff access to dashboard
      items.push({
        page: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
      });
      // Add items based on permissions
      for (const perm of user.permissions) {
        const mapped = PERMISSION_PAGE_MAP[perm];
        if (mapped) {
          items.push(mapped);
        }
      }
      return items;
    }

    default:
      return [
        { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      ];
  }
}

// ── Helper: get initials from name ──
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Helper: get role display info ──
function getRoleDisplay(role: string): {
  label: string;
  className: string;
} {
  switch (role) {
    case "SUPERUSER":
      return {
        label: "Superuser",
        className: "bg-amber-100 text-amber-700 border-amber-200",
      };
    case "OPERATOR":
      return {
        label: "Operator",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      };
    case "STAFF":
      return {
        label: "Staff",
        className: "bg-sky-100 text-sky-700 border-sky-200",
      };
    case "POLICE":
      return {
        label: "Police",
        className: "bg-rose-100 text-rose-700 border-rose-200",
      };
    default:
      return {
        label: role,
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

// ── Nav item button component ──
function NavItemButton({
  item,
  currentPage,
  onClick,
}: {
  item: NavItem;
  currentPage: string;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const isActive = currentPage === item.page;

  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {isActive && (
        <span className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon
        className={`size-[18px] shrink-0 transition-colors ${
          isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
        }`}
      />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <Badge
          variant="secondary"
          className="ml-auto h-5 min-w-[20px] items-center justify-center bg-rose-500 px-1.5 text-[10px] font-bold text-white"
        >
          {item.badge}
        </Badge>
      )}
    </button>
  );
}

// ── Sidebar content (shared between desktop & mobile) ──
// ── Subscription status widget for provider sidebar ──
function SubscriptionStatusCard({ collapsed }: { collapsed: boolean }) {
  const subscription = useAppStore((s) => s.subscription);

  if (!subscription) return null;

  const isActive = subscription.status === "ACTIVE";
  const isWarning = subscription.status === "WARNING";
  const isGrace = subscription.status === "GRACE";
  const isSuspended = subscription.status === "SUSPENDED";

  // Collapsed mode — icon indicator
  if (collapsed) {
    const bgClass = isActive
      ? "bg-emerald-100"
      : isSuspended || isGrace
      ? "bg-rose-100"
      : "bg-amber-100";
    const iconClass = isActive
      ? "text-emerald-600"
      : isSuspended || isGrace
      ? "text-rose-600"
      : "text-amber-600";
    return (
      <div className="flex flex-col items-center gap-1 px-2 py-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bgClass} animate-pulse shadow-sm`}> 
          <Clock className={`size-4 ${iconClass}`} />
        </div>
      </div>
    );
  }

  // Expanded card
  const containerClass = isActive
    ? "border-emerald-200 bg-emerald-50"
    : isSuspended || isGrace
    ? "border-rose-200 bg-rose-50"
    : "border-amber-200 bg-amber-50";

  const iconColorClass = isActive
    ? "text-emerald-600"
    : isSuspended || isGrace
    ? "text-rose-600"
    : "text-amber-600";

  const titleClass = isActive
    ? "text-emerald-800"
    : isSuspended || isGrace
    ? "text-rose-800"
    : "text-amber-800";

  const subtextClass = isActive
    ? "text-emerald-700"
    : isSuspended || isGrace
    ? "text-rose-700"
    : "text-amber-700";

  const badgeClass = isActive
    ? "bg-emerald-200/60 text-emerald-800"
    : isSuspended || isGrace
    ? "bg-rose-200/60 text-rose-800"
    : "bg-amber-200/60 text-amber-800";

  const Icon = isSuspended || isGrace ? AlertTriangle : Clock;

  return (
    <div className={`rounded-lg border p-3 ${containerClass} animate-subtle-pulse shadow-sm`}> 
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconColorClass}`} />
        <p className={`text-xs font-semibold ${titleClass}`}>
          {isActive
            ? "Subscription Active"
            : isSuspended
            ? "Service Suspended"
            : isGrace
            ? "Subscription Expired"
            : "Expiring Soon"}
        </p>
      </div>
      <div className={`mt-1.5 flex items-center justify-between text-[11px] ${subtextClass}`}>
        <span>{formatDaysRemaining(subscription.daysRemaining)}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold ${badgeClass}`}>
          <Clock className="h-3 w-3" />
          {Math.abs(subscription.daysRemaining)}d
        </span>
      </div>
      {subscription.price > 0 ? (
        <div className={`mt-1 text-[11px] ${subtextClass}`}>
          Due: {subscription.price.toLocaleString()} ETB / {formatCycle(subscription.cycle)}
        </div>
      ) : (
        <div className={`mt-1 text-[11px] ${subtextClass}`}>
          {formatCycle(subscription.cycle)} cycle — Free trial
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  user,
  currentPage,
  onNavigate,
  onLogout,
  collapsed,
  onToggleCollapse,
}: {
  user: CurrentUser;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { jointSession, setJointLoginDialogOpen, subscription } = useAppStore();
  const navItems = getNavItems(user);
  const roleDisplay = getRoleDisplay(user.role);

  // Determine if user can start a joint session (SUPERUSER or POLICE ADMIN)
  const canStartJoint =
    user.role === "SUPERUSER" ||
    (user.role === "POLICE" && user.policeRank === "ADMIN");

  return (
    <div className="flex h-full flex-col">
      {/* ── User profile section ── */}
      <div className="px-3 pt-3 pb-2">
        <div
          className={`flex items-center gap-3 ${collapsed ? "flex-col text-center" : ""}`}
        >
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              {/* SUPERUSER: Name with dropdown menu (My Profile + Sign Out) */}
              {user.role === "SUPERUSER" ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex w-full items-center justify-between gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-slate-50 group">
                      <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-primary">
                        {user.name}
                      </p>
                      <ChevronDown className="size-3.5 shrink-0 text-slate-400 group-hover:text-primary transition-colors" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-52">
                    {/* User info header */}
                    <div className="flex items-center gap-2.5 px-2 py-2.5">
                      <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                        <p className="truncate text-[11px] text-slate-400">System Administrator</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2.5 cursor-pointer"
                      onClick={() => onNavigate("settings")}
                    >
                      <UserCircle className="size-4 text-slate-500" />
                      <span>My Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="flex items-center gap-2.5 cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                      onClick={() => onLogout()}
                    >
                      <LogOut className="size-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user.name}
                  </p>
                  <button
                    onClick={onLogout}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="size-4 shrink-0" />
                  </button>
                </div>
              )}
              <div className="mt-0.5 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold leading-none px-1.5 py-0.5 ${roleDisplay.className}`}
                >
                  <Shield className="mr-1 size-2.5" />
                  {roleDisplay.label}
                </Badge>
                {user.role === "POLICE" && user.policeRank && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-semibold leading-none px-1.5 py-0.5 ${RANK_BADGE_CLASSES[(user.policeRank as PoliceRank)] || ""}`}
                  >
                    {RANK_LABELS[(user.policeRank as PoliceRank)] || user.policeRank}
                  </Badge>
                )}
                {user.providerName && (
                  <span className="truncate text-[11px] text-slate-400">
                    {user.providerName}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-slate-200/60" />

      {/* ── Navigation links ── */}
      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavItemButton
              key={item.page}
              item={item}
              currentPage={currentPage}
              onClick={() => onNavigate(item.page)}
            />
          ))}

          {/* Joint Operations — only shown during active joint session */}
          {jointSession.active && (
            <>
              <Separator className="my-2 bg-slate-200/60" />
              <NavItemButton
                item={{ page: "joint-operations", label: "Joint Operations", icon: ShieldCheck }}
                currentPage={currentPage}
                onClick={() => onNavigate("joint-operations")}
              />
            </>
          )}

          {/* Start Joint Session button — shown for SUPERUSER/POLICE ADMIN when no joint session */}
          {canStartJoint && !jointSession.active && !collapsed && (
            <>
              <Separator className="my-2 bg-slate-200/60" />
              <button
                onClick={() => setJointLoginDialogOpen(true)}
                className="flex w-full items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5 text-sm font-medium text-amber-700 transition-all hover:bg-amber-50 hover:border-amber-400 hover:text-amber-800 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <ShieldCheck className="size-[18px] shrink-0" />
                <span>Start Joint Session</span>
              </button>
            </>
          )}
          {canStartJoint && !jointSession.active && collapsed && (
            <button
              onClick={() => setJointLoginDialogOpen(true)}
              className="flex items-center justify-center rounded-lg border border-dashed border-amber-300 p-2 text-amber-600 hover:bg-amber-50 transition-colors outline-none"
              title="Start Joint Session"
            >
              <ShieldCheck className="size-[18px]" />
            </button>
          )}
        </nav>
      </ScrollArea>

      {/* ── Subscription status for providers ── */}
      {(user.role === "OPERATOR" || user.role === "STAFF") && (
        <div className="px-3 py-2">
          <SubscriptionStatusCard collapsed={collapsed} />
        </div>
      )}

      <Separator className="bg-slate-200/60" />

      {/* ── Bottom section: collapse toggle + logout ── */}
      <div className="p-3">
        {/* Desktop collapse toggle */}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-[18px] text-slate-400" />
            <span>Collapse</span>
          </button>
        )}

        {/* Logout — hidden for SUPERUSER (moved to name dropdown) */}
        {user.role !== "SUPERUSER" && (
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Sidebar Component ──
export default function Sidebar() {
  const { currentUser, currentPage, setCurrentPage, setCurrentUser, sidebarOpen, setSidebarOpen } =
    useAppStore();
  const isMobile = useIsMobile();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted || !currentUser) return null;

  async function handleLogout() {
    // Clear httpOnly cookie on server
    await apiLogout();
    // Clear local state
    setCurrentUser(null);
    setCurrentPage("login");
    if (isMobile) setSidebarOpen(false);
  }

  function handleNavigate(page: string) {
    setCurrentPage(page);
    if (isMobile) setSidebarOpen(false);
  }

  // ── Mobile: render as a Sheet ──
  if (isMobile) {
    return (
      <>
        {/* Mobile hamburger button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5 text-slate-700" />
        </button>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Building2 className="size-4 text-white" />
                </div>
                <SheetTitle className="text-sm font-bold text-slate-900">
                  GHMS
                </SheetTitle>
              </div>
            </SheetHeader>
            <SidebarContent
              user={currentUser}
              currentPage={currentPage}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              collapsed={false}
              onToggleCollapse={() => {}}
            />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // ── Desktop: render as a fixed sidebar ──
  const collapsed = !sidebarOpen;

  return (
    <aside
      className={`relative flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out ${
        collapsed ? "w-[68px]" : "w-64"
      }`}
    >
      {/* ── Logo / Brand ── */}
      <div
        className={`flex h-16 items-center border-b border-slate-200/60 px-4 ${collapsed ? "justify-center" : "gap-3"}`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
          <Building2 className="size-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-slate-900">
              GHMS
            </h1>
            <p className="truncate text-[11px] text-slate-400">
              Guest House Management
            </p>
          </div>
        )}
        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute -right-3 top-5 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50"
            aria-label="Expand sidebar"
          >
            <Menu className="size-3 text-slate-500" />
          </button>
        )}
      </div>

      <SidebarContent
        user={currentUser}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        collapsed={collapsed}
        onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
      />
    </aside>
  );
}