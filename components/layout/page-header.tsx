import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  count?: number;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  count,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="w-[3px] h-7 rounded-full flex-shrink-0 mt-0.5"
          style={{ background: "oklch(0.72 0.19 48)" }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              className="text-xl font-bold tracking-tight"
              style={{ color: "oklch(0.13 0.025 260)" }}
            >
              {title}
            </h1>
            {count !== undefined && (
              <span
                className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  background: "oklch(0.955 0.006 80)",
                  color: "oklch(0.52 0.012 260)",
                }}
              >
                {count}
              </span>
            )}
          </div>
          {description && (
            <p
              className="text-sm mt-0.5"
              style={{ color: "oklch(0.52 0.012 260)" }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 mt-0.5">{action}</div>}
    </div>
  );
}
