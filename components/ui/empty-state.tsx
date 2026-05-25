import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 gap-4",
        className,
      )}
    >
      <div className="relative">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
          style={{
            background: "oklch(0.96 0.01 60)",
            border: "1px solid oklch(0.90 0.04 60)",
          }}
        >
          <Icon className="w-8 h-8" style={{ color: "oklch(0.72 0.19 48)" }} />
        </div>
        <div
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
          style={{ background: "oklch(0.88 0.12 60)" }}
        />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold" style={{ color: "oklch(0.25 0.02 260)" }}>
          {title}
        </p>
        {description && (
          <p className="text-xs max-w-[220px]" style={{ color: "oklch(0.55 0.012 260)" }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
