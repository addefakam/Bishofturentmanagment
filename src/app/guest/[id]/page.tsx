'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Room {
  id: string;
  number: string;
  name: string;
  type: string;
  pricePerNight: number;
  floor: number;
  capacity: number;
  status: string;
  amenities: string;
  description: string;
}

interface HouseDetail {
  id: string;
  name: string;
  type: string;
  phone: string;
  email: string;
  address: string;
  subcity: string;
  woreda: string;
  licenseNo: string;
  rooms: Room[];
  createdAt: string;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  SINGLE: 'Single',
  DOUBLE: 'Double',
  TWIN: 'Twin',
  SUITE: 'Suite',
  DELUXE: 'Deluxe',
};

const ROOM_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  RESERVED: 'bg-blue-100 text-blue-700',
};

// Police office phone - update this to the actual Bishoftu police number
const POLICE_PHONE = '+251917702996';

export default function GuestHouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [house, setHouse] = useState<HouseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCallConfirm, setShowCallConfirm] = useState(false);

  useEffect(() => {
    params.then(async ({ id }) => {
      try {
        const res = await fetch(`/api/guest/houses/${id}`);
        if (!res.ok) {
          setHouse(null);
          return;
        }
        const data = await res.json();
        setHouse(data);
      } catch {
        setHouse(null);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const availableRooms = house?.rooms.filter((r) => r.status === 'AVAILABLE') || [];

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-1/3 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-gray-100" />
        <div className="h-24 rounded-xl bg-gray-100" />
        <div className="h-60 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!house) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
        <p className="text-gray-500 font-medium">Guest house not found</p>
        <p className="text-gray-400 text-sm mt-1">
          It may have been removed or is not yet approved.
        </p>
        <Link
          href="/guest"
          className="inline-block mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Back to Browse
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Link
        href="/guest"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to list
      </Link>

      {/* Header Card */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-5 text-white shadow-lg">
        <h1 className="text-xl font-bold">{house.name}</h1>
        <p className="text-emerald-100 text-sm mt-1">
          {house.type.replace(/_/g, ' ')}
        </p>
        <div className="flex items-center gap-1.5 mt-3 text-emerald-100 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {house.subcity}, {house.woreda}
          {house.address && ` - ${house.address}`}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
            {house.rooms.length} rooms
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
            {availableRooms.length} available
          </span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
            License: {house.licenseNo}
          </span>
        </div>
      </div>

      {/* Contact & Report Section */}
      <div className="grid grid-cols-1 gap-3">
        {/* Contact Guest House */}
        {house.phone && (
          <a
            href={`tel:${house.phone}`}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Call Guest House</p>
              <p className="text-sm text-gray-500">{house.phone}</p>
            </div>
          </a>
        )}

        {/* Report to Police - Main CTA */}
        <button
          onClick={() => setShowCallConfirm(true)}
          className="flex items-center gap-3 rounded-xl border-2 border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-all active:scale-[0.98] w-full text-left"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-800">Report to Police Office</p>
            <p className="text-sm text-red-600">
              Call to report issues or get assistance
            </p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-red-400 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Call Police Confirmation Dialog */}
      {showCallConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex size-14 mx-auto items-center justify-center rounded-full bg-red-100 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-7 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <h3 className="text-center text-lg font-bold text-gray-900">
              Call Bishoftu Police
            </h3>
            <p className="text-center text-sm text-gray-500 mt-2">
              You will be connected to the Bishoftu Police Office to report your
              concern about <strong>{house.name}</strong>.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowCallConfirm(false)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <a
                href={`tel:${POLICE_PHONE}`}
                onClick={() => setShowCallConfirm(false)}
                className="flex-1 rounded-xl bg-red-600 py-3 text-center text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Call Now
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Rooms List */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Rooms ({house.rooms.length})</h2>
        {house.rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white py-8 text-center">
            <p className="text-gray-400 text-sm">No rooms listed yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {house.rooms.map((room) => (
              <div
                key={room.id}
                className="rounded-xl border border-gray-100 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        Room {room.number}
                      </h3>
                      {room.name && room.name !== room.number && (
                        <span className="text-sm text-gray-400">
                          - {room.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span>{ROOM_TYPE_LABELS[room.type] || room.type}</span>
                      <span>{room.capacity} guest{room.capacity > 1 ? 's' : ''}</span>
                      {room.floor > 0 && <span>Floor {room.floor}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {room.pricePerNight.toLocaleString()} ETB
                    </p>
                    <p className="text-xs text-gray-400">per night</p>
                  </div>
                </div>

                {room.amenities && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {room.amenities
                      .split(',')
                      .map((a) => a.trim())
                      .filter(Boolean)
                      .slice(0, 5)
                      .map((amenity, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-gray-50 px-2 py-0.5 text-xs text-gray-500"
                        >
                          {amenity}
                        </span>
                      ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      ROOM_STATUS_COLORS[room.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {room.status}
                  </span>
                  {room.status === 'AVAILABLE' && (
                    <button
                      onClick={() => setShowCallConfirm(true)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                    >
                      Report Issue
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Spacer for fixed nav */}
      <div className="h-8" />
    </div>
  );
}
