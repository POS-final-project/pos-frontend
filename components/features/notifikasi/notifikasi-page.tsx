"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell, AlertTriangle, ArrowLeftRight, CheckCircle,
  XCircle, RotateCcw, Info, CheckCheck, BellOff, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { api } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType =
  | "low_stock"
  | "transfer_incoming"
  | "transfer_confirmed"
  | "transfer_rejected"
  | "refund"
  | "system";

type Notification = {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
};

type Meta = { total: number; page: number; limit: number; totalPages: number };
type FilterKey = "all" | "unread" | NotifType;

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<NotifType, { icon: React.ElementType; label: string; chip: string }> = {
  low_stock:          { icon: AlertTriangle,  label: "Stok Kritis",    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200"   },
  transfer_incoming:  { icon: ArrowLeftRight, label: "Transfer Masuk", chip: "bg-blue-50 text-blue-700 ring-1 ring-blue-200"      },
  transfer_confirmed: { icon: CheckCircle,    label: "Disetujui",      chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  transfer_rejected:  { icon: XCircle,        label: "Ditolak",        chip: "bg-red-50 text-red-700 ring-1 ring-red-200"         },
  refund:             { icon: RotateCcw,      label: "Refund",         chip: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" },
  system:             { icon: Info,           label: "Sistem",         chip: "bg-slate-100 text-slate-600 ring-1 ring-slate-200"  },
};

const TABS: { key: FilterKey; label: string; types?: NotifType[] }[] = [
  { key: "all",               label: "Semua" },
  { key: "unread",            label: "Belum Dibaca" },
  { key: "low_stock",         label: "Stok",     types: ["low_stock"] },
  { key: "transfer_incoming", label: "Transfer", types: ["transfer_incoming", "transfer_confirmed", "transfer_rejected"] },
  { key: "refund",            label: "Refund",   types: ["refund"] },
  { key: "system",            label: "Sistem",   types: ["system"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)     return "Baru saja";
  if (diff < 3600)   return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

function extractList(raw: unknown): Notification[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Notification[];
  const o = raw as Record<string, unknown>;
  return (o.data ?? o.items ?? o.rows ?? []) as Notification[];
}

function extractMeta(raw: unknown): Meta | null {
  if (!raw) return null;
  return ((raw as Record<string, unknown>).meta ?? null) as Meta | null;
}

function applyFilter(items: Notification[], filter: FilterKey): Notification[] {
  if (filter === "all")    return items;
  if (filter === "unread") return items.filter(n => !n.is_read);
  const tab = TABS.find(t => t.key === filter);
  if (tab?.types) return items.filter(n => tab.types!.includes(n.type));
  return items.filter(n => n.type === filter);
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function NotifRow({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const cfg = TYPE_CFG[notif.type] ?? TYPE_CFG.system;
  const Icon = cfg.icon;

  return (
    <div
      onClick={() => !notif.is_read && onRead(notif.id)}
      className={`
        flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-0
        transition-colors duration-150
        ${notif.is_read
          ? "bg-white hover:bg-slate-50/70"
          : "bg-blue-50/30 hover:bg-blue-50/50 cursor-pointer"
        }
      `}
    >
      {/* Unread indicator */}
      <div className="flex items-center justify-center w-2.5 shrink-0 mt-1.5">
        {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
      </div>

      {/* Icon */}
      <div className={`
        w-9 h-9 rounded-lg flex items-center justify-center shrink-0
        ${notif.is_read ? "bg-slate-100" : "bg-white shadow-sm border border-slate-200"}
      `}>
        <Icon className={`w-4 h-4 ${notif.is_read ? "text-slate-400" : "text-slate-600"}`} strokeWidth={1.8} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm leading-snug ${notif.is_read ? "text-slate-500 font-normal" : "text-slate-700 font-medium"}`}>
            {notif.title}
          </p>
          <time className="text-xs text-slate-400 whitespace-nowrap shrink-0 tabular-nums mt-0.5">
            {relativeTime(notif.created_at)}
          </time>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
          {notif.body}
        </p>
        <div className="mt-1.5">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${cfg.chip}`}>
            {cfg.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotifSkeleton() {
  return (
    <div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 last:border-0">
          <div className="w-2.5 shrink-0" />
          <div className="w-9 h-9 rounded-lg bg-slate-100 shrink-0 animate-pulse" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="flex justify-between gap-3">
              <div className="h-3.5 w-44 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-16 bg-slate-100 rounded-md animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function NotifikasiPage() {
  const [items, setItems]     = useState<Notification[]>([]);
  const [meta, setMeta]       = useState<Meta | null>(null);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError]     = useState("");
  const [filter, setFilter]   = useState<FilterKey>("all");

  const fetchNotifs = useCallback(async (pg: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<unknown>(`/api/notifications?page=${pg}&limit=50`);
      setItems(extractList(res));
      setMeta(extractMeta(res));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat notifikasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchNotifs(page); }, [page, fetchNotifs]);

  async function handleMarkRead(id: string) {
    try {
      await api.patch(`/api/notifications/${id}/read`, {});
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch { /* ignore */ }
  }

  async function handleMarkAll() {
    setMarking(true);
    try {
      await api.patch("/api/notifications/read-all", {});
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch { /* ignore */ } finally {
      setMarking(false);
    }
  }

  const unreadCount = items.filter(n => !n.is_read).length;
  const filtered    = applyFilter(items, filter);

  const tabCount = (tab: typeof TABS[number]) => {
    if (tab.key === "all" || tab.key === "unread") return unreadCount;
    return items.filter(n => !n.is_read && tab.types?.includes(n.type)).length;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifikasi"
        description="Aktivitas dan pemberitahuan terbaru"
      />

      {/* ── Main card ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

        {/* Tabs + action bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-2 pr-4">
          <div className="flex">
            {TABS.map(tab => {
              const count  = tabCount(tab);
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`
                    relative flex items-center gap-1.5 px-4 py-3.5 text-sm whitespace-nowrap transition-colors
                    border-b-2 -mb-px
                    ${active
                      ? "border-slate-900 text-slate-900 font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-700 font-normal"
                    }
                  `}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`
                      inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold
                      ${active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"}
                    `}>
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={marking}
              className="text-xs text-slate-400 hover:text-slate-600 gap-1.5 h-7 px-2 shrink-0"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {marking ? "Memproses…" : "Tandai semua dibaca"}
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <NotifSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-14">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">{error}</p>
              <p className="text-xs text-slate-400 mt-0.5">Coba muat ulang halaman</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNotifs(page)}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Coba lagi
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={filter === "unread" ? "Semua sudah dibaca" : "Tidak ada notifikasi"}
            description={
              filter === "unread"
                ? "Anda sudah up-to-date dengan semua aktivitas."
                : "Notifikasi akan muncul di sini saat ada aktivitas."
            }
          />
        ) : (
          <div>
            {filtered.map(notif => (
              <NotifRow key={notif.id} notif={notif} onRead={handleMarkRead} />
            ))}
          </div>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={meta?.totalPages ?? 1}
        onPageChange={setPage}
        total={meta?.total}
        pageSize={50}
      />
    </div>
  );
}
