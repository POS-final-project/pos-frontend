"use client";

import { Plus, Trash2, Globe, Store, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  scope: "global" | "shop";
  shop_id: string | null;
  Shop: { name: string } | null;
  last_active_at: string;
};

interface SessionSidebarProps {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHr < 24) return `${diffHr} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SessionSidebarProps) {
  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-slate-50/60">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Sesi Chat
            </span>
          </div>
          {sessions.length > 0 && (
            <span
              className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
              style={{
                background: "oklch(0.955 0.006 80)",
                color: "oklch(0.52 0.012 260)",
              }}
            >
              {sessions.length}
            </span>
          )}
        </div>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-amber-950 text-sm font-medium transition-colors shadow-sm shadow-amber-200/60"
        >
          <Plus className="w-4 h-4" />
          Percakapan Baru
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1.5 [scrollbar-width:thin] [scrollbar-color:oklch(0.708_0_0/40%)_transparent]">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 px-4 text-center">
            <MessageSquare className="w-7 h-7 mb-2 opacity-20" />
            <p className="text-xs text-slate-400">Belum ada percakapan.</p>
            <p className="text-xs text-slate-400">Mulai percakapan baru.</p>
          </div>
        ) : (
          <ul className="px-2 space-y-0.5">
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              const label = s.Shop?.name ?? "Semua Toko";
              return (
                <li key={s.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer transition-all",
                      isActive
                        ? "bg-amber-50 ring-1 ring-amber-200/80 shadow-sm"
                        : "hover:bg-white hover:shadow-sm",
                    )}
                    onClick={() => onSelect(s.id)}
                  >
                    {/* Scope icon */}
                    <div
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors",
                        isActive
                          ? "bg-amber-100 text-amber-600"
                          : "bg-slate-100 text-slate-400 group-hover:bg-slate-200/80",
                      )}
                    >
                      {s.scope === "global" ? (
                        <Globe className="w-3.5 h-3.5" />
                      ) : (
                        <Store className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-[13px] font-medium truncate leading-tight",
                          isActive ? "text-amber-800" : "text-slate-700",
                        )}
                      >
                        {label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {s.scope === "global" ? "Global · " : "Toko · "}
                        {formatDate(s.last_active_at)}
                      </p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 text-slate-300 transition-all flex-shrink-0"
                      title="Hapus sesi"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
