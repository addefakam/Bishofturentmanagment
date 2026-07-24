"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions: number[];
  totalItems: number;
  rangeInfo: { from: number; to: number; total: number };
  goToPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Generate an array of page numbers to display, with ellipsis for gaps.
 * Shows: first, current +/- 1, last, with ellipsis in between.
 */
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push("ellipsis");
  }

  // Show pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  // Always show last page
  if (total > 1) {
    pages.push(total);
  }

  return pages;
}

export function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  rangeInfo,
  goToPage,
  setPageSize,
}: PaginationControlsProps) {
  // Don't render pagination if only 1 page
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3">
      {/* Left: showing info + page size selector */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground order-2 sm:order-1">
        <span className="text-xs whitespace-nowrap">
          Showing {rangeInfo.from}&ndash;{rangeInfo.to} of {rangeInfo.total}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs whitespace-nowrap">Rows:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => setPageSize(Number(val))}
          >
            <SelectTrigger size="sm" className="h-7 w-[60px] text-xs px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: page navigation */}
      <Pagination className="order-1 sm:order-2 mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => goToPage(currentPage - 1)}
              className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              aria-disabled={currentPage <= 1}
            />
          </PaginationItem>

          {pageNumbers.map((page, idx) =>
            page === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={page === currentPage}
                  onClick={() => goToPage(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => goToPage(currentPage + 1)}
              className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
              aria-disabled={currentPage >= totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
