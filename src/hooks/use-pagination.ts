"use client";

import { useState, useMemo, useCallback } from "react";

interface UsePaginationOptions {
  /** Total number of items */
  totalItems: number;
  /** Initial page size (default: 10) */
  initialPageSize?: number;
  /** Available page size options (default: [5, 10, 20, 50]) */
  pageSizeOptions?: number[];
}

interface UsePaginationReturn {
  /** Current page index (0-based internally, but 1-based for display) */
  currentPage: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Available page size options */
  pageSizeOptions: number[];
  /** Go to a specific page (1-based) */
  goToPage: (page: number) => void;
  /** Change the number of items per page (resets to page 1) */
  setPageSize: (size: number) => void;
  /** Slice an array to the current page items */
  paginate: <T>(items: T[]) => T[];
  /** Current page range info: "Showing X to Y of Z" */
  rangeInfo: { from: number; to: number; total: number };
  /** Reset to page 1 (e.g. when search changes) */
  resetToFirst: () => void;
}

export function usePagination({
  totalItems,
  initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const rangeInfo = useMemo(() => {
    const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalItems);
    return { from, to, total: totalItems };
  }, [currentPage, pageSize, totalItems]);

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(clamped);
    },
    [totalPages]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1); // Reset to first page on size change
  }, []);

  const resetToFirst = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const paginate = useCallback(
    <T>(items: T[]): T[] => {
      const start = (currentPage - 1) * pageSize;
      return items.slice(start, start + pageSize);
    },
    [currentPage, pageSize]
  );

  return {
    currentPage,
    pageSize,
    totalPages,
    pageSizeOptions,
    goToPage,
    setPageSize,
    paginate,
    rangeInfo,
    resetToFirst,
  };
}

