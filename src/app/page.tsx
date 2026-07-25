"use client";

import { useAppStore } from "@/lib/store";
import LoginPage from "@/components/ghms/login-page";
import Sidebar from "@/components/ghms/sidebar";
import PageRenderer from "@/components/ghms/page-renderer";

export default function Home() {
  const { currentUser, currentPage } = useAppStore();

  if (!currentUser || currentPage === "login") {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <PageRenderer />
      </main>
    </div>
  );
}