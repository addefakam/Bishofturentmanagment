import { create } from "zustand";

const STORAGE_KEY = "ghms_session";

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  role: string;
  providerId: string | null;
  permissions: string[];
  policeRank: string;
  providerName?: string;
}

interface PreselectedRoom {
  id: string;
  number: string;
  name: string;
  type: string;
  pricePerNight: number;
}

interface AppState {
  currentPage: string;
  setCurrentPage: (p: string) => void;
  currentUser: CurrentUser | null;
  setCurrentUser: (u: CurrentUser | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
  refreshKey: number;
  triggerRefresh: () => void;
  preselectedRoom: PreselectedRoom | null;
  setPreselectedRoom: (r: PreselectedRoom | null) => void;
}

// ── localStorage helpers (SSR-safe) ──
function loadSession(): {
  currentUser: CurrentUser | null;
  currentPage: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.currentUser) return data;
    return null;
  } catch {
    return null;
  }
}

function persistSession(user: CurrentUser | null, page?: string) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          currentUser: user,
          currentPage: page || useAppStore.getState().currentPage,
        }),
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage may be full or blocked — silently ignore
  }
}

// ── Load persisted session at store creation (runs once on client) ──
const initialSession = loadSession();

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: initialSession?.currentPage || "login",
  setCurrentPage: (p) => {
    const user = get().currentUser;
    if (user) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ currentUser: user, currentPage: p }),
          );
        } catch {}
      }
    }
    set({ currentPage: p });
  },
  currentUser: initialSession?.currentUser ?? null,
  setCurrentUser: (u) => {
    persistSession(u);
    if (!u) {
      set({ currentUser: null, currentPage: "login" });
    } else {
      set({ currentUser: u });
    }
  },
  sidebarOpen: true,
  setSidebarOpen: (o) => set({ sidebarOpen: o }),
  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
  preselectedRoom: null,
  setPreselectedRoom: (r) => set({ preselectedRoom: r }),
}));
