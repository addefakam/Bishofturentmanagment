"use client";

import { useState } from "react";
import { Receipt, Package, Sparkles } from "lucide-react";

import ExpensesPage from "./expenses-page";
import ResourcesPage from "./resources-page";
import HousekeepingPage from "./housekeeping-page";

type TabType = "expenses" | "resources" | "housekeeping";

const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: "expenses", label: "Expenses", icon: Receipt },
  { key: "resources", label: "Resources", icon: Package },
  { key: "housekeeping", label: "Housekeeping", icon: Sparkles },
];

export default function OperationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("expenses");

  return (
    <div className="h-full flex flex-col">
      {/* Tab Bar */}
      <div className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Operations
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Manage expenses, resources, and housekeeping tasks.
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
        {activeTab === "expenses" && <ExpensesPage />}
        {activeTab === "resources" && <ResourcesPage />}
        {activeTab === "housekeeping" && <HousekeepingPage />}
      </div>
    </div>
  );
}
