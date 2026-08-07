'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const SUBCITIES = ['Cheleleka', 'Dibayyu', 'Dukem'];

interface Room {
  id: string;
  number: string;
  name: string;
  type: string;
  pricePerNight: number;
  capacity: number;
  status: string;
  amenities: string;
}

interface GuestHouse {
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

export default function GuestPage() {
  const [houses, setHouses] = useState<GuestHouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subcity, setSubcity] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchHouses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '12',
      });
      if (subcity) params.set('subcity', subcity);
      if (search) params.set('search', search);

      const res = await fetch(`/api/guest/houses?${params}`);
      const data = await res.json();
      setHouses(data.houses || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      setHouses([]);
    } finally {
      setLoading(false);
    }
  }, [page, subcity, search]);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [subcity, search]);

  const availableRoomCount = (house: GuestHouse) =>
    house.rooms.filter((r) => r.status === 'AVAILABLE').length;

  const minPrice = (house: GuestHouse) =>
    house.rooms.length > 0
      ? Math.min(...house.rooms.map((r) => r.pricePerNight))
      : 0;

  return (
    <div className="space-y-4">
      {/* Hero Section */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-5 text-white shadow-lg">
        <h1 className="text-xl font-bold mb-1">Find Guest Houses in Bishoftu</h1>
        <p className="text-emerald-100 text-sm">
          Browse licensed guest houses. {total} registered establishments.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {/* Sub-city Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setSubcity('')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              subcity === ''
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
            }`}
          >
            All Areas
          </button>
          {SUBCITIES.map((sc) => (
            <button
              key={sc}
              onClick={() => setSubcity(sc)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                subcity === sc
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
              }`}
            >
              {sc}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-100 bg-white p-4"
            >
              <div className="h-5 w-3/5 rounded bg-gray-200 mb-3" />
              <div className="h-4 w-2/5 rounded bg-gray-100 mb-2" />
              <div className="h-4 w-1/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : houses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto size-10 text-gray-300 mb-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <p className="text-gray-500 font-medium">No guest houses found</p>
          <p className="text-gray-400 text-sm mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {houses.map((house) => (
            <Link
              key={house.id}
              href={`/guest/${house.id}`}
              className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {house.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {house.subcity}, {house.woreda}
                  </p>
                  {house.address && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {house.address}
                    </p>
                  )}
                </div>
                {availableRoomCount(house) > 0 && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {availableRoomCount(house)} available
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  {house.rooms.length} rooms
                </div>
                {house.rooms.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    From {minPrice(house).toLocaleString()} ETB
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                  {house.type.replace(/_/g, ' ')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
