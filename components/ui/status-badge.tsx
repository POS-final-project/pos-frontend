import { cn } from "@/lib/utils";

const BADGE_CONFIG: Record<string, { label: string; classes: string }> = {
  // Transaction status
  selesai:  { label: "Selesai",    classes: "bg-green-50 text-green-700 border-green-200" },
  refunded: { label: "Refunded",   classes: "bg-red-50 text-red-600 border-red-200" },
  // Payment method
  cash:     { label: "Tunai",      classes: "bg-slate-50 text-slate-600 border-slate-200" },
  qris:     { label: "QRIS",       classes: "bg-violet-50 text-violet-700 border-violet-200" },
  // Product / general
  active:   { label: "Aktif",      classes: "bg-green-50 text-green-700 border-green-200" },
  inactive: { label: "Nonaktif",   classes: "bg-slate-100 text-slate-500 border-slate-200" },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = BADGE_CONFIG[status] ?? {
    label: status,
    classes: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center text-[11px] font-semibold leading-none px-2 py-1 rounded-full border whitespace-nowrap",
        config.classes,
        className,
      )}
    >
      {label ?? config.label}
    </span>
  );
}
