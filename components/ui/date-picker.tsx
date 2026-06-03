"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function DatePicker({
  value,
  onChange,
  onBlur,
  placeholder = "Pilih tanggal",
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selected = value ? new Date(value + "T00:00:00") : null;
  const [viewYear, setViewYear] = useState(
    selected?.getFullYear() ?? today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    selected?.getMonth() ?? today.getMonth(),
  );

  // Position popup relative to trigger
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopupStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      zIndex: 9999,
    });
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onBlur]);

  // Sync view when value changes externally
  useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function formatDisplay(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleSelect(day: number) {
    const m = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
    onBlur?.();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    onBlur?.();
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = Array.from(
    { length: firstDay + daysInMonth },
    (_, i) => (i < firstDay ? null : i - firstDay + 1),
  );

  const selectedDay =
    selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth
      ? selected.getDate()
      : null;

  const todayDay =
    today.getFullYear() === viewYear && today.getMonth() === viewMonth
      ? today.getDate()
      : null;

  const popup = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={popupRef}
      style={popupStyle}
      className="w-68 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
    >
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 select-none">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[11px] font-medium text-slate-400 py-1 select-none"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => (
          <div key={i} className="flex justify-center">
            {day ? (
              <button
                type="button"
                onClick={() => handleSelect(day)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors select-none",
                  day === selectedDay
                    ? "bg-amber-500 text-white font-semibold shadow-sm"
                    : day === todayDay
                      ? "border border-amber-300 text-amber-700 font-medium hover:bg-amber-50"
                      : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {day}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm transition-colors",
          "hover:border-amber-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50",
          open && "border-amber-400 ring-1 ring-amber-400/50",
          !value && "text-muted-foreground",
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="flex-1 text-left truncate text-sm">
          {value ? formatDisplay(value) : placeholder}
        </span>
        {value && (
          <X
            className="h-3 w-3 shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            onClick={handleClear}
          />
        )}
      </button>

      {popup}
    </div>
  );
}
