"use client";

import { useState } from "react";
import { Users, CalendarCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GuestsPage from "./guests-page";
import ReservationsPage from "./reservations-page";

export default function GuestsReservationsPage() {
  const [tab, setTab] = useState("guests");

  return (
    <div className="space-y-0 p-4 md:p-6">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        {/* Tab switcher header */}
        <div className="flex items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tab === "guests" ? "Guests" : "Reservations"}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {tab === "guests"
                ? "Manage guest profiles and information"
                : "Manage bookings, check-ins and check-outs"}
            </p>
          </div>
          <TabsList className="ml-auto">
            <TabsTrigger value="guests" className="gap-1.5">
              <Users className="h-4 w-4" />
              Guests
            </TabsTrigger>
            <TabsTrigger value="reservations" className="gap-1.5">
              <CalendarCheck className="h-4 w-4" />
              Reservations
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Remove inner padding since each sub-page already has p-4 md:p-6 */}
        <TabsContent value="guests" className="mt-0 -mx-4 md:-mx-6">
          <GuestsPage />
        </TabsContent>
        <TabsContent value="reservations" className="mt-0 -mx-4 md:-mx-6">
          <ReservationsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
