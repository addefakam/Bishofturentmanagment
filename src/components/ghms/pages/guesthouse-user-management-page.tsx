"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Building2, Users } from "lucide-react";

import ProvidersPage from "./providers-page";
import OwnerAccountsPage from "./owner-accounts-page";

type TabType = "guesthouses" | "users";

export default function GuesthouseUserManagementPage() {
  const { currentUser } = useAppStore();
  const isSuperuser = currentUser?.role === "SUPERUSER";
  const isPolice = currentUser?.role === "POLICE";

  // For POLICE role, default to users (police officers management)
  // For SUPERUSER, default to guesthouses
  const [activeTab, setActiveTab] = useState<TabType>(
    isPolice ? "users" : "guesthouses"
  );

  // Police only see the users tab (their officer management)
  if (isPolice) {
    return (
      <div className="h-full">
        <OwnerAccountsPage />
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
    { key: "guesthouses", label: "Guesthouses", icon: Building2 },
    { key: "users", label: "User Management", icon: Users },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Guesthouse & User Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {isSuperuser
                ? "Register new guesthouses, manage operator credentials, and manage police admin accounts."
                : "Manage provider applications, operator credentials, and police officer accounts."}
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "guesthouses" ? <ProvidersPage /> : <OwnerAccountsPage />}
      </div>
    </div>
  );
}
