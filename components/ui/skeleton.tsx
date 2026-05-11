import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-slate-100", className)} />
  );
}

export function TableSkeleton({
  cols,
  rows = 6,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className={cn(
                  "h-4 rounded animate-pulse bg-slate-100",
                  j === 0
                    ? "w-6 mx-auto"
                    : j === cols - 1
                      ? "w-8 mx-auto"
                      : "w-full max-w-28",
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
