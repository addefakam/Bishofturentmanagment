"use client";

import { useState } from "react";
import { ShieldAlert, UserX, Users } from "lucide-react";
import SuspectAlertsPage from "./suspect-alerts-page";
import SuspectedPersonsPage from "./suspected-persons-page";

const TABS = [
  { key: "alerts", label: "Alerts", icon: ShieldAlert },
  { key: "watchlist", label: "Suspected Persons", icon: UserX },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SuspectManagementPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("alerts");

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "alerts" ? <SuspectAlertsPage /> : <SuspectedPersonsPage />}
    </div>
  );
}
