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
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionSidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: SessionSidebarProps) {
  return (
    <div className="flex flex-col h-full border-r border-slate-200 bg-white">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-700">
              Sesi Chat
            </span>
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {sessions.length}
          </span>
        </div>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Percakapan Baru
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2 [scrollbar-width:thin] [scrollbar-color:oklch(0.708_0_0/50%)_transparent]">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 px-4 text-center">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">Belum ada percakapan.</p>
            <p className="text-xs">Buat percakapan baru untuk mulai.</p>
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
                      "group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all",
                      isActive
                        ? "bg-indigo-50 ring-1 ring-indigo-200"
                        : "hover:bg-slate-50",
                    )}
                    onClick={() => onSelect(s.id)}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        isActive
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      {s.scope === "global" ? (
                        <Globe className="w-4 h-4" />
                      ) : (
                        <Store className="w-4 h-4" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          isActive ? "text-indigo-700" : "text-slate-700",
                        )}
                      >
                        {label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {formatDate(s.last_active_at)}
                      </p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 hover:text-red-500 text-slate-400 transition-all flex-shrink-0"
                      title="Hapus sesi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
