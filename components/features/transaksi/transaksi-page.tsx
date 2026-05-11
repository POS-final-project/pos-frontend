"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Receipt,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRp(n: string | number | null | undefined) {
  if (n === null || n === undefined) return "-";
  const v = parseFloat(String(n));
  if (isNaN(v)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(v);
}

function txTotal(tx: Transaction): number | string | null | undefined {
  return tx.subtotal ?? tx.total_amount ?? tx.total;
}

function txDate(tx: Transaction): string | null | undefined {
  return tx.createdAt ?? tx.created_at ?? tx.paid_at;
}

function formatDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function extractTransactions(data: unknown): {
  items: Transaction[];
  totalPages: number;
} {
  if (!data || typeof data !== "object") return { items: [], totalPages: 1 };
  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.data)) {
    const totalPages =
      typeof obj.meta === "object" &&
      obj.meta !== null &&
      typeof (obj.meta as Record<string, unknown>).totalPages === "number"
        ? ((obj.meta as Record<string, unknown>).totalPages as number)
        : 1;
    return { items: obj.data as Transaction[], totalPages };
  }

  const inner = (obj.data ?? obj) as Record<string, unknown>;

  if (Array.isArray(inner))
    return { items: inner as Transaction[], totalPages: 1 };

  const rows = inner.rows ?? inner.data ?? inner.items;
  const tp = typeof inner.totalPages === "number" ? inner.totalPages : 1;
  if (Array.isArray(rows))
    return { items: rows as Transaction[], totalPages: tp };

  return { items: [], totalPages: 1 };
}

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as T[];
    if (d && typeof d === "object") {
      const dd = (d as Record<string, unknown>).data;
      if (Array.isArray(dd)) return dd as T[];
    }
  }
  return [];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Shop = { id: string; name: string };

type TransactionItem = {
  id: string;
  product_variant_id: string;
  ProductVariant?: {
    id: string;
    name: string;
    sku?: string;
    Product?: { id: string; name: string };
  };
  qty: number | string;
  price: number | string;
  subtotal?: number | string;
};

type Transaction = {
  id: string;
  shop_id?: string;
  Shop?: { id: string; name: string };
  user_id?: string;
  user?: { id: string; name: string };
  User?: { id: string; name: string };
  customer_id?: string;
  Customer?: { id: string; name: string; phone?: string };
  payment_method: "cash" | "transfer" | "qris" | "credit";
  status: "pending" | "completed" | "cancelled";
  total_amount?: number | string; // some API shapes use "total" instead
  total?: number | string;
  subtotal?: number | string;
  note?: string;
  createdAt?: string;
  created_at: string;
  paid_at?: string;
  items?: TransactionItem[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Tunai",
  transfer: "Transfer",
  qris: "QRIS",
  credit: "Kredit",
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j} className="py-3">
              <div
                className={cn(
                  "h-4 rounded-md bg-slate-100",
                  j === 0 ? "w-6 mx-auto" : j === cols - 1 ? "w-8 mx-auto" : "w-full max-w-[120px]",
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TransaksiPageProps {
  role: "superadmin" | "admin" | "user";
}

export function TransaksiPage({ role }: TransaksiPageProps) {
  const authUser = getUser();

  // Shop list & selection (superadmin = all shops, admin = their shops)
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Detail dialog
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Used to debounce fetch on filter change
  const fetchRef = useRef(0);

  // ─── Fetchers ─────────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(
    async (shopId: string, pg: number) => {
      const ticket = ++fetchRef.current;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(pg));
        params.set("limit", "20");
        if (shopId) params.set("shopId", shopId);
        if (filterStatus) params.set("status", filterStatus);
        if (filterPayment) params.set("payment_method", filterPayment);
        if (filterDateFrom) params.set("date_from", filterDateFrom);
        if (filterDateTo) params.set("date_to", filterDateTo);

        const res = await api.get<{ data: unknown }>(
          `/api/transactions?${params.toString()}`,
        );
        if (ticket !== fetchRef.current) return;
        const { items, totalPages: tp } = extractTransactions(res.data);
        setTransactions(items);
        setTotalPages(tp);
      } catch (err) {
        if (ticket !== fetchRef.current) return;
        setError(err instanceof Error ? err.message : "Gagal memuat transaksi");
      } finally {
        if (ticket === fetchRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterStatus, filterPayment, filterDateFrom, filterDateTo, role],
  );

  // Mount: resolve shop selection for each role
  useEffect(() => {
    const init = async () => {
      if (role === "user") {
        const cookieShopId = authUser?.shopId;
        if (cookieShopId) {
          setSelectedShopId(cookieShopId);
        } else {
          try {
            const res = await api.get<{ data: unknown }>(
              "/api/shops?page=1&limit=100",
            );
            const list = extractList<Shop>(res.data);
            setShops(list);
            if (list.length > 0) setSelectedShopId(list[0].id);
            else setLoading(false);
          } catch {
            setLoading(false);
          }
        }
        return;
      }

      if (role === "superadmin") {
        // fetch shops for dropdown; selectedShopId stays "" = all shops
        try {
          const res = await api.get<{ data: unknown }>(
            "/api/shops?page=1&limit=100",
          );
          setShops(extractList<Shop>(res.data));
        } catch {
          /* ignore — dropdown just stays empty */
        }
        return;
      }

      // admin & user: must have a shopId before fetching transactions
      const cookieShopId = authUser?.shopId;
      if (cookieShopId) {
        setSelectedShopId(cookieShopId);
        if (role === "admin") {
          // also fetch shop list for the dropdown (admin may manage multiple)
          api
            .get<{ data: unknown }>("/api/shops?page=1&limit=100")
            .then((r) => setShops(extractList<Shop>(r.data)))
            .catch(() => {
              /* ignore */
            });
        }
      } else {
        // shopId not in cookie → fetch from API and take first
        try {
          const res = await api.get<{ data: unknown }>(
            "/api/shops?page=1&limit=100",
          );
          const list = extractList<Shop>(res.data);
          setShops(list);
          if (list.length > 0) {
            setSelectedShopId(list[0].id);
          } else {
            setLoading(false); // no shops → nothing to show
          }
        } catch {
          setLoading(false);
        }
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch transactions whenever shopId or page is ready
  useEffect(() => {
    // admin still needs a chosen shop; user is filtered by token on the backend
    if (role === "admin" && !selectedShopId) return;
    fetchTransactions(selectedShopId, page);
  }, [selectedShopId, page, fetchTransactions, role]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [
    filterStatus,
    filterPayment,
    filterDateFrom,
    filterDateTo,
    selectedShopId,
  ]);

  // ─── Detail ───────────────────────────────────────────────────────────────

  async function openDetail(tx: Transaction) {
    setDetailTx(tx);
    setDetailOpen(true);
    if (tx.items && tx.items.length > 0) return; // already have items
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      if (tx.shop_id) params.set("shopId", tx.shop_id);
      const res = await api.get<{ data: unknown }>(
        `/api/transactions/${tx.id}?${params.toString()}`,
      );
      const raw = res.data as Record<string, unknown>;
      const detail =
        (raw.data as Transaction | null) ?? (raw as unknown as Transaction);
      setDetailTx(detail);
    } catch {
      // keep existing
    } finally {
      setDetailLoading(false);
    }
  }

  // ─── Filter helpers ───────────────────────────────────────────────────────

  function clearFilters() {
    setFilterStatus("");
    setFilterPayment("");
    setFilterDateFrom("");
    setFilterDateTo("");
    if (role === "superadmin") setSelectedShopId("");
  }

  const hasActiveFilter =
    filterStatus ||
    filterPayment ||
    filterDateFrom ||
    filterDateTo ||
    (role === "superadmin" && selectedShopId);

  // ─── Render ───────────────────────────────────────────────────────────────

  const showShopColumn = role === "superadmin";
  const showShopDropdown =
    (role === "superadmin" || role === "admin") && shops.length > 0;

  const currentShopName =
    shops.find((s) => s.id === selectedShopId)?.name ?? null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Transaksi</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {role === "superadmin"
              ? "Semua transaksi lintas toko"
              : currentShopName
                ? `Toko: ${currentShopName}`
                : "Transaksi toko Anda"}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        {/* Shop dropdown — superadmin & admin */}
        {showShopDropdown && (
          <div className="flex flex-col gap-1 min-w-44">
            <span className="text-xs font-medium text-slate-500">Toko</span>
            <Select
              value={selectedShopId || "__all"}
              onValueChange={(v) =>
                setSelectedShopId(v === "__all" ? "" : (v ?? ""))
              }
            >
              <SelectTrigger className="h-9 text-sm">
                <span className="truncate">
                  {selectedShopId
                    ? shops.find((s) => s.id === selectedShopId)?.name
                    : "Semua Toko"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {role === "superadmin" && (
                  <SelectItem value="__all">Semua Toko</SelectItem>
                )}
                {shops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Dari</span>
          <Input
            type="date"
            className="h-9 text-sm w-38"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Sampai</span>
          <Input
            type="date"
            className="h-9 text-sm w-38"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1 min-w-36">
          <span className="text-xs font-medium text-slate-500">Status</span>
          <Select
            value={filterStatus || "__all"}
            onValueChange={(v) =>
              setFilterStatus(v === "__all" ? "" : (v ?? ""))
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <span>{filterStatus ? STATUS_LABEL[filterStatus] : "Semua"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Semua Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payment method */}
        <div className="flex flex-col gap-1 min-w-36">
          <span className="text-xs font-medium text-slate-500">
            Pembayaran
          </span>
          <Select
            value={filterPayment || "__all"}
            onValueChange={(v) =>
              setFilterPayment(v === "__all" ? "" : (v ?? ""))
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <span>
                {filterPayment ? PAYMENT_LABEL[filterPayment] : "Semua"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Semua Metode</SelectItem>
              <SelectItem value="cash">Tunai</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="qris">QRIS</SelectItem>
              <SelectItem value="credit">Kredit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear */}
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 text-slate-500 self-end"
            onClick={clearFilters}
          >
            <X className="w-3.5 h-3.5" />
            Reset
          </Button>
        )}

      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {!loading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
              <SearchX className="w-8 h-8 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500">Tidak ada transaksi</p>
              <p className="text-xs text-slate-400 mt-1">
                {hasActiveFilter ? "Coba ubah atau reset filter yang aktif" : "Belum ada data transaksi tersedia"}
              </p>
            </div>
            {hasActiveFilter && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="gap-1.5 text-xs">
                <X className="w-3.5 h-3.5" />
                Reset Filter
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-3">
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Waktu</TableHead>
                  {showShopColumn && <TableHead>Toko</TableHead>}
                  <TableHead>Pelanggan</TableHead>
                  {role !== "user" && <TableHead>Kasir</TableHead>}
                  <TableHead>Pembayaran</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 text-center">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton cols={5 + (showShopColumn ? 1 : 0) + (role !== "user" ? 1 : 0) + 2} />
                ) : (
                  transactions.map((tx, i) => {
                    const kasirName = tx.User?.name ?? tx.user?.name ?? "-";
                    return (
                      <TableRow key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <TableCell className="text-center tabular-nums text-slate-400 text-xs">
                          {(page - 1) * 20 + i + 1}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap text-slate-500">
                          {formatDate(txDate(tx))}
                        </TableCell>
                        {showShopColumn && (
                          <TableCell className="text-sm text-slate-700">
                            {tx.Shop?.name ?? "-"}
                          </TableCell>
                        )}
                        <TableCell className="text-sm">
                          {tx.Customer ? (
                            <div>
                              <p className="font-medium text-slate-800">
                                {tx.Customer.name}
                              </p>
                              {tx.Customer.phone && (
                                <p className="text-xs text-slate-400">
                                  {tx.Customer.phone}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Umum</span>
                          )}
                        </TableCell>
                        {role !== "user" && (
                          <TableCell className="text-sm text-slate-600">
                            {kasirName}
                          </TableCell>
                        )}
                        <TableCell>
                          <span className="text-xs font-medium text-slate-600">
                            {PAYMENT_LABEL[tx.payment_method] ??
                              tx.payment_method}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-slate-900 text-sm">
                          {formatRp(txTotal(tx))}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full border",
                              STATUS_CLASS[tx.status] ??
                                "bg-slate-100 text-slate-600 border-slate-200",
                            )}
                          >
                            {STATUS_LABEL[tx.status] ?? tx.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-400 hover:text-indigo-600"
                            onClick={() => openDetail(tx)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 text-xs">
            Halaman <span className="font-medium text-slate-700">{page}</span> dari <span className="font-medium text-slate-700">{totalPages}</span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="gap-1 h-8 px-2.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </Button>

            {/* Page numbers */}
            {(() => {
              const delta = 2;
              const start = Math.max(1, page - delta);
              const end = Math.min(totalPages, page + delta);
              const pages: (number | "...")[] = [];
              if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
              for (let p = start; p <= end; p++) pages.push(p);
              if (end < totalPages) { if (end < totalPages - 1) pages.push("..."); pages.push(totalPages); }
              return pages.map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-xs select-none">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(p)}
                    className={cn("h-8 w-8 p-0 text-xs", p === page && "pointer-events-none")}
                  >
                    {p}
                  </Button>
                )
              );
            })()}

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1 h-8 px-2.5"
            >
              <span className="hidden sm:inline">Berikutnya</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              Detail Transaksi
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              Memuat detail...
            </div>
          ) : detailTx ? (
            <div className="space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Waktu</p>
                  <p className="font-medium text-slate-800">
                    {formatDate(txDate(detailTx))}
                  </p>
                </div>
                {detailTx.Shop && (
                  <div>
                    <p className="text-xs text-slate-400">Toko</p>
                    <p className="font-medium text-slate-800">
                      {detailTx.Shop.name}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400">Kasir</p>
                  <p className="font-medium text-slate-800">
                    {detailTx.User?.name ?? detailTx.user?.name ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pelanggan</p>
                  <p className="font-medium text-slate-800">
                    {detailTx.Customer?.name ?? "Umum"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Metode Bayar</p>
                  <p className="font-medium text-slate-800">
                    {PAYMENT_LABEL[detailTx.payment_method] ??
                      detailTx.payment_method}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      STATUS_CLASS[detailTx.status] ??
                        "bg-slate-100 text-slate-600 border-slate-200",
                    )}
                  >
                    {STATUS_LABEL[detailTx.status] ?? detailTx.status}
                  </span>
                </div>
                {detailTx.note && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">Catatan</p>
                    <p className="text-slate-700">{detailTx.note}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              {detailTx.items && detailTx.items.length > 0 ? (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-medium text-slate-600">
                          Produk
                        </th>
                        <th className="text-center px-3 py-2.5 font-medium text-slate-600 w-16">
                          Qty
                        </th>
                        <th className="text-right px-3 py-2.5 font-medium text-slate-600 w-28">
                          Harga
                        </th>
                        <th className="text-right px-3 py-2.5 font-medium text-slate-600 w-28">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailTx.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-slate-800">
                              {item.ProductVariant?.Product?.name ?? "-"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {item.ProductVariant?.name ?? ""}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-slate-700">
                            {Number(item.qty)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                            {formatRp(item.price)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                            {formatRp(
                              item.subtotal ??
                                Number(item.qty) * Number(item.price),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-2.5 text-right font-semibold text-slate-700"
                        >
                          Total
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-indigo-700 tabular-nums">
                          {formatRp(txTotal(detailTx))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">
                  Detail item tidak tersedia
                </p>
              )}

              {/* Total */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-500">Total Pembayaran</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {formatRp(txTotal(detailTx))}
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
