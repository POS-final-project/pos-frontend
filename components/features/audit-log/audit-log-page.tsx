"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Eye, X,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

const ENTITY_TYPES = [
  "user", "shop", "product", "product_variant", "category",
  "inventory", "transfer", "transaction", "refund", "customer",
] as const;

const ACTION_MAP: Record<string, string[]> = {
  user: ["login", "register_admin", "register_user", "reset_password", "change_password", "update", "update_profile", "update_photo"],
  shop: ["create", "update", "delete", "assign_staff", "remove_staff"],
  product: ["create", "update", "delete"],
  product_variant: ["create", "update", "delete"],
  category: ["create", "update", "delete"],
  inventory: ["restock", "adjust_out", "set_threshold"],
  transfer: ["create", "approve", "reject", "cancel"],
  transaction: ["create", "cancel"],
  refund: ["create"],
  customer: ["create", "update", "delete"],
};

const ALL_ACTIONS = Array.from(new Set(Object.values(ACTION_MAP).flat())).sort();

const ENTITY_LABEL: Record<string, string> = {
  user: "User",
  shop: "Toko",
  product: "Produk",
  product_variant: "Varian",
  category: "Kategori",
  inventory: "Inventory",
  transfer: "Transfer",
  transaction: "Transaksi",
  refund: "Refund",
  customer: "Pelanggan",
};

const ACTION_COLOR: Record<string, string> = {
  create: "bg-green-50 text-green-700 ring-1 ring-green-200",
  update: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  delete: "bg-red-50 text-red-700 ring-1 ring-red-200",
  login: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  approve: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  reject: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  cancel: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Shop = { id: string; name: string };

type Meta = { total: number; page: number; limit: number; totalPages: number };

type AuditLog = {
  id: string;
  user_id?: string | null;
  shop_id?: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: unknown;
  new_values?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
  User?: { id: string; name: string; email: string } | null;
  Shop?: { id: string; name: string } | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AuditLogPageProps {
  role: "superadmin" | "admin";
}

export function AuditLogPage({ role }: AuditLogPageProps) {
  const user = getUser();

  // list
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filters
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  // ─── Fetchers ──────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async (
    shopId: string,
    pg: number,
    entity: string,
    action: string,
    dateFrom: string,
    dateTo: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(pg));
      params.set("limit", "20");
      if (shopId) params.set("shopId", shopId);
      if (entity) params.set("entity_type", entity);
      if (action) params.set("action", action);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const res = await api.get<{ success: boolean; data: AuditLog[]; meta: Meta }>(`/api/audit-logs?${params.toString()}`);
      setLogs(Array.isArray(res.data) ? res.data : []);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (role === "superadmin") {
        try {
          const res = await api.get<{ success: boolean; data: Shop[] }>("/api/shops?page=1&limit=100");
          setShops(Array.isArray(res.data) ? res.data : []);
        } catch { /* ignore */ }
        fetchLogs("", 1, "", "", "", "");
      } else {
        const shopId = user?.shopId ?? "";
        setSelectedShopId(shopId);
        fetchLogs(shopId, 1, "", "", "", "");
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters(
    shopId = selectedShopId,
    entity = filterEntity,
    action = filterAction,
    dateFrom = filterDateFrom,
    dateTo = filterDateTo,
  ) {
    setPage(1);
    fetchLogs(shopId, 1, entity, action, dateFrom, dateTo);
  }

  function clearFilters() {
    setFilterEntity("");
    setFilterAction("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
    fetchLogs(selectedShopId, 1, "", "", "", "");
  }

  function changePage(next: number) {
    setPage(next);
    fetchLogs(selectedShopId, next, filterEntity, filterAction, filterDateFrom, filterDateTo);
  }

  const hasActiveFilters = filterEntity || filterAction || filterDateFrom || filterDateTo;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader
        title="Log & Audit"
        description="Rekam jejak seluruh aksi mutasi yang terjadi di sistem"
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Filter</p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-xs text-slate-400 hover:text-slate-600 gap-1.5 h-7 px-2"
            >
              <X className="w-3 h-3" />
              Hapus filter
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Shop filter — superadmin only */}
          {role === "superadmin" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Toko</Label>
              <Select
                value={selectedShopId}
                onValueChange={(v) => {
                  const val = v ?? "";
                  setSelectedShopId(val);
                  applyFilters(val);
                }}
              >
                <SelectTrigger className="h-9 text-sm">
                  <span className="truncate">
                    {selectedShopId
                      ? (shops.find((s) => s.id === selectedShopId)?.name ?? selectedShopId)
                      : "Semua"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua</SelectItem>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Entity type */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Entitas</Label>
            <Select
              value={filterEntity}
              onValueChange={(v) => {
                const val = v ?? "";
                setFilterEntity(val);
                setFilterAction("");
                applyFilters(selectedShopId, val, "");
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <span className="truncate">
                  {filterEntity ? (ENTITY_LABEL[filterEntity] ?? filterEntity) : "Semua"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua</SelectItem>
                {ENTITY_TYPES.map((e) => (
                  <SelectItem key={e} value={e}>{ENTITY_LABEL[e]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Aksi</Label>
            <Select
              value={filterAction}
              onValueChange={(v) => {
                const val = v ?? "";
                setFilterAction(val);
                applyFilters(selectedShopId, filterEntity, val);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <span className="truncate capitalize">
                  {filterAction ? filterAction.replace(/_/g, " ") : "Semua"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua</SelectItem>
                {(filterEntity ? (ACTION_MAP[filterEntity] ?? ALL_ACTIONS) : ALL_ACTIONS).map((a) => (
                  <SelectItem key={a} value={a} className="capitalize">{a.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date from */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Dari Tanggal</Label>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              onBlur={() => applyFilters()}
              className="h-9 text-sm"
            />
          </div>

          {/* Date to */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Sampai Tanggal</Label>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              onBlur={() => applyFilters()}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody><TableSkeleton cols={6} rows={8} /></tbody>
          </table>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Tidak ada log"
            description="Belum ada aktivitas yang terekam dengan filter saat ini"
          />
        ) : (
          <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-10 [&_td]:py-2.5">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead>Pengguna</TableHead>
                {role === "superadmin" && <TableHead>Toko</TableHead>}
                <TableHead>Entitas</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead className="hidden lg:table-cell">IP</TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead className="w-16 text-right">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log, i) => (
                <TableRow key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="text-center tabular-nums text-slate-400 text-xs">
                    {(page - 1) * 20 + i + 1}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium text-slate-700">
                      {log.User?.name ?? <span className="italic text-slate-300">Sistem</span>}
                    </p>
                    {log.User?.email && (
                      <p className="text-xs text-slate-400 truncate max-w-36" title={log.User.email}>
                        {log.User.email}
                      </p>
                    )}
                  </TableCell>
                  {role === "superadmin" && (
                    <TableCell className="text-slate-500 text-sm">
                      {log.Shop?.name ?? <span className="italic text-slate-300">-</span>}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {ENTITY_LABEL[log.entity_type] ?? log.entity_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-md capitalize",
                        ACTION_COLOR[log.action] ?? "bg-slate-100 text-slate-600",
                      )}
                    >
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-slate-400 font-mono">
                    {log.ip_address ?? "-"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-slate-400 hover:text-amber-600"
                      onClick={() => { setDetailLog(log); setDetailOpen(true); }}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={changePage}
        pageSize={20}
      />

      {/* ── Detail Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Detail Log
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Pengguna</p>
                  <p className="font-medium">{detailLog.User?.name ?? "-"}</p>
                  {detailLog.User?.email && (
                    <p className="text-xs text-slate-400">{detailLog.User.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Toko</p>
                  <p className="font-medium">{detailLog.Shop?.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Entitas</p>
                  <p className="font-medium">{ENTITY_LABEL[detailLog.entity_type] ?? detailLog.entity_type}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Aksi</p>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-md capitalize",
                      ACTION_COLOR[detailLog.action] ?? "bg-slate-100 text-slate-600",
                    )}
                  >
                    {detailLog.action.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">ID Entitas</p>
                  <p className="font-mono text-xs text-slate-600 break-all">{detailLog.entity_id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Waktu</p>
                  <p>{formatDate(detailLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">IP Address</p>
                  <p className="font-mono text-xs">{detailLog.ip_address ?? "-"}</p>
                </div>
              </div>

              {/* old_values */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Nilai Sebelumnya
                </p>
                {detailLog.old_values == null ? (
                  <p className="text-xs text-slate-400 italic">-</p>
                ) : (
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-slate-700 max-h-48">
                    {JSON.stringify(detailLog.old_values, null, 2)}
                  </pre>
                )}
              </div>

              {/* new_values */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Nilai Sesudahnya
                </p>
                {detailLog.new_values == null ? (
                  <p className="text-xs text-slate-400 italic">-</p>
                ) : (
                  <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all text-slate-700 max-h-48">
                    {JSON.stringify(detailLog.new_values, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
