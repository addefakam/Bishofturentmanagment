"use client";

import { useState } from "react";
import { Building2, Users, Hotel } from "lucide-react";
import ProvidersPage from "./providers-page";
import SuperUserManagementPage from "./super-user-management-page";

const TABS = [
  { key: "guesthouses", label: "Guesthouses", icon: Building2 },
  { key: "users", label: "User Management", icon: Users },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SuperGuesthouseUsersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("guesthouses");

  return (
    <div>
      {/* Tab Bar */}
      <div className="border-b bg-white px-4 pt-4 md:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-1">
          <Hotel className="h-5 w-5 text-primary mr-1.5 shrink-0" />
          <h1 className="text-lg font-bold tracking-tight text-slate-900 mr-6">Guesthouse &amp; User Management</h1>
          <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "guesthouses" ? <ProvidersPage /> : <SuperUserManagementPage />}
    </div>
  );
}
