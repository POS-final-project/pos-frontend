"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  className?: string;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, "...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }

  return pages;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  const rangeStart = pageSize ? (page - 1) * pageSize + 1 : undefined;
  const rangeEnd = pageSize && total ? Math.min(page * pageSize, total) : undefined;

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {/* Left: range info */}
      <p className="hidden text-xs text-slate-400 tabular-nums sm:block">
        {rangeStart && rangeEnd && total
          ? `${rangeStart}–${rangeEnd} dari ${total}`
          : `Halaman ${page} dari ${totalPages}`}
      </p>

      {/* Center / right: controls */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition-all",
            "border-slate-200 bg-white text-slate-600",
            "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-0.5">
          {pages.map((p, i) =>
            p === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="flex h-8 w-8 items-center justify-center text-xs text-slate-400"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-medium tabular-nums transition-all",
                  p === page
                    ? "border-amber-400 bg-amber-500 text-white shadow-sm shadow-amber-200"
                    : [
                        "border-transparent bg-transparent text-slate-600",
                        "hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700",
                      ],
                )}
              >
                {p}
              </button>
            ),
          )}
        </div>

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border text-sm transition-all",
            "border-slate-200 bg-white text-slate-600",
            "hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600",
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
