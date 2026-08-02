"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import LoginPage from "@/components/ghms/login-page";
import Sidebar from "@/components/ghms/sidebar";
import PageRenderer from "@/components/ghms/page-renderer";
import { apiGetNotifications } from "@/lib/api";
import { Bell } from "lucide-react";

export default function Home() {
  const { currentUser, currentPage, setCurrentPage } = useAppStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await apiGetNotifications();
      const count = (data as { isRead: boolean }[]).filter((n) => !n.isRead).length;
      setUnreadCount(count);
    } catch {
      // silent - non-critical
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [currentUser, fetchUnreadCount, currentPage]);

  if (!currentUser || currentPage === "login") {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-end px-4 md:px-6 h-12 shrink-0 bg-white border-b border-slate-100">
          <button
            onClick={() => setCurrentPage("notifications")}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto pl-4 md:pl-6">
          <PageRenderer />
        </main>
      </div>
    </div>
  );
}
