"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Eye, RotateCcw, Search,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";

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

function formatDate(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Shop = { id: string; name: string };

type Refund = {
  id: string;
  transaction_id: string;
  user_id: string;
  reason?: string | null;
  total_amount: number | string;
  status: string;
  created_at: string;
  User?: { id: string; name: string };
  Transaction?: {
    id: string;
    invoice_no?: string;
    shop_id: string;
    Shop?: { id: string; name: string };
  };
};

type RefundItem = {
  id: string;
  transaction_item_id: string;
  qty: number | string;
  amount: number | string;
  TransactionItem?: {
    id: string;
    product_variant_id: string;
    qty: number | string;
    price: number | string;
    ProductVariant?: {
      id: string;
      name: string;
      sku?: string;
      Product?: { id: string; name: string };
    };
  };
};

type TxItem = {
  id: string;
  product_variant_id: string;
  qty: number | string;
  price: number | string;
  subtotal?: number | string;
  ProductVariant?: {
    id: string;
    name: string;
    sku?: string;
    Product?: { id: string; name: string };
  };
};

type Transaction = {
  id: string;
  invoice_no?: string;
  shop_id?: string;
  Shop?: { id: string; name: string };
  status: string;
  created_at?: string;
  total_amount?: number | string;
  total?: number | string;
  subtotal?: number | string;
  items?: TxItem[];
};

// ─── Component ────────────────────────────────────────────────────────────────

interface RefundPageProps {
  role: "superadmin" | "admin";
}

export function RefundPage({ role }: RefundPageProps) {
  const { toast } = useToast();
  const user = getUser();

  // list
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // shop filter
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");

  // detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRefund, setDetailRefund] = useState<Refund | null>(null);
  const [detailItems, setDetailItems] = useState<RefundItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"search" | "items">("search");
  const [txIdInput, setTxIdInput] = useState("");
  const [txSearchLoading, setTxSearchLoading] = useState(false);
  const [txSearchError, setTxSearchError] = useState("");
  const [foundTx, setFoundTx] = useState<Transaction | null>(null);
  const [itemQtys, setItemQtys] = useState<Record<string, string>>({});
  const [refundReason, setRefundReason] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // ─── Fetchers ──────────────────────────────────────────────────────────────

  const fetchRefunds = useCallback(async (shopId: string, pg: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(pg));
      params.set("limit", "20");
      if (shopId) params.set("shopId", shopId);
      const res = await api.get<{ success: boolean; data: unknown; meta?: Record<string, number> }>(`/api/refunds?${params.toString()}`);
      setRefunds(Array.isArray(res.data) ? (res.data as Refund[]) : []);
      setTotalPages(res.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat refund");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (role === "superadmin") {
        try {
          const res = await api.get<{ data: unknown }>("/api/shops?page=1&limit=100");
          setShops(extractList<Shop>(res.data));
        } catch { /* ignore */ }
        fetchRefunds("", 1);
      } else {
        const shopId = user?.shopId ?? "";
        setSelectedShopId(shopId);
        try {
          const res = await api.get<{ data: unknown }>("/api/shops?page=1&limit=100");
          setShops(extractList<Shop>(res.data));
        } catch { /* ignore */ }
        fetchRefunds(shopId, 1);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Detail ────────────────────────────────────────────────────────────────

  async function openDetail(refund: Refund) {
    setDetailRefund(refund);
    setDetailItems([]);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: unknown }>(`/api/refunds/${refund.id}`);
      const data = (res.data as Record<string, unknown>).data as Record<string, unknown>;
      setDetailItems(Array.isArray(data.items) ? (data.items as RefundItem[]) : []);
    } catch { /* show empty */ }
    setDetailLoading(false);
  }

  // ─── Create — search transaction ───────────────────────────────────────────

  async function handleSearchTx(e: React.FormEvent) {
    e.preventDefault();
    const id = txIdInput.trim();
    if (!id) return;
    setTxSearchLoading(true);
    setTxSearchError("");
    try {
      const res = await api.get<{ data: unknown }>(`/api/transactions/${id}`);
      const tx = (res.data as Record<string, unknown>).data as Transaction;
      if (tx.status !== "selesai") {
        setTxSearchError("Hanya transaksi yang sudah selesai yang dapat direfund");
        return;
      }
      setFoundTx(tx);
      const qtys: Record<string, string> = {};
      (tx.items ?? []).forEach((item) => { qtys[item.id] = ""; });
      setItemQtys(qtys);
      setCreateStep("items");
    } catch (err) {
      setTxSearchError(err instanceof Error ? err.message : "Transaksi tidak ditemukan");
    } finally {
      setTxSearchLoading(false);
    }
  }

  // ─── Create — submit refund ────────────────────────────────────────────────

  async function handleSubmitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!foundTx) return;
    const items = (foundTx.items ?? [])
      .filter((item) => Number(itemQtys[item.id]) > 0)
      .map((item) => ({ transaction_item_id: item.id, qty: Number(itemQtys[item.id]) }));
    if (items.length === 0) {
      setCreateError("Masukkan jumlah refund minimal 1 unit untuk setidaknya satu item");
      return;
    }
    setCreateLoading(true);
    setCreateError("");
    try {
      await api.post("/api/refunds", {
        transaction_id: foundTx.id,
        reason: refundReason.trim() || undefined,
        items,
      });
      toast({ title: "Refund berhasil diproses", variant: "success" });
      setCreateOpen(false);
      resetCreate();
      fetchRefunds(selectedShopId, page);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal memproses refund");
    } finally {
      setCreateLoading(false);
    }
  }

  function resetCreate() {
    setCreateStep("search");
    setTxIdInput("");
    setTxSearchError("");
    setFoundTx(null);
    setItemQtys({});
    setRefundReason("");
    setCreateError("");
  }

  function changePage(next: number) {
    setPage(next);
    fetchRefunds(selectedShopId, next);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refund"
        description="Riwayat pengembalian barang dari transaksi"
        count={loading ? undefined : refunds.length}
        action={
          <div className="flex items-center gap-2">
            {role === "superadmin" && shops.length > 0 && (
              <Select
                value={selectedShopId}
                onValueChange={(v) => {
                  const val = v ?? "";
                  setSelectedShopId(val);
                  setPage(1);
                  fetchRefunds(val, 1);
                }}
              >
                <SelectTrigger className="w-44">
                  <span className="truncate text-sm">
                    {selectedShopId
                      ? (shops.find((s) => s.id === selectedShopId)?.name ?? selectedShopId)
                      : "Semua Toko"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua Toko</SelectItem>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={() => { resetCreate(); setCreateOpen(true); }} className="gap-2">
              <Plus className="w-4 h-4" />
              Buat Refund
            </Button>
          </div>
        }
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody><TableSkeleton cols={6} rows={5} /></tbody>
          </table>
        ) : refunds.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="Belum ada refund"
            description="Refund akan muncul di sini setelah diproses"
            action={
              <Button onClick={() => { resetCreate(); setCreateOpen(true); }} variant="outline" size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Buat Refund
              </Button>
            }
          />
        ) : (
          <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-3">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>No. Invoice</TableHead>
                {role === "superadmin" && <TableHead>Toko</TableHead>}
                <TableHead>Kasir</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead className="text-right">Total Refund</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refunds.map((r, i) => (
                <TableRow key={r.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="text-center tabular-nums text-slate-400">
                    {(page - 1) * 20 + i + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-700">
                    {r.Transaction?.invoice_no ?? "-"}
                  </TableCell>
                  {role === "superadmin" && (
                    <TableCell className="text-slate-500 text-sm">
                      {r.Transaction?.Shop?.name ?? "-"}
                    </TableCell>
                  )}
                  <TableCell className="text-slate-600 text-sm">
                    {r.User?.name ?? "-"}
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm max-w-40 truncate" title={r.reason ?? undefined}>
                    {r.reason ?? <span className="italic text-slate-300">-</span>}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600 tabular-nums">
                    {formatRp(r.total_amount)}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                    {formatDate(r.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-slate-500 hover:text-amber-600"
                      onClick={() => openDetail(r)}
                    >
                      <Eye className="w-3 h-3" />
                      Detail
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-red-500" />
              Detail Refund
            </DialogTitle>
          </DialogHeader>
          {detailRefund && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">No. Invoice</p>
                  <p className="font-mono text-xs font-medium">
                    {detailRefund.Transaction?.invoice_no ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Toko</p>
                  <p className="font-medium">{detailRefund.Transaction?.Shop?.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Kasir</p>
                  <p>{detailRefund.User?.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Tanggal</p>
                  <p>{formatDate(detailRefund.created_at)}</p>
                </div>
                {detailRefund.reason && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-0.5">Alasan</p>
                    <p className="text-slate-700">{detailRefund.reason}</p>
                  </div>
                )}
                <div className="col-span-2 pt-1 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-0.5">Total Refund</p>
                  <p className="font-bold text-red-600 text-lg">{formatRp(detailRefund.total_amount)}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Item yang Direfund
                </p>
                {detailLoading ? (
                  <p className="text-sm text-slate-400 text-center py-4">Memuat...</p>
                ) : detailItems.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Tidak ada data item</p>
                ) : (
                  <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {detailItems.map((item, i) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2.5 text-sm bg-white">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800">
                            {item.TransactionItem?.ProductVariant?.Product?.name ?? `Item ${i + 1}`}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.TransactionItem?.ProductVariant?.name ?? ""}
                            {item.TransactionItem?.ProductVariant?.sku
                              ? ` · ${item.TransactionItem.ProductVariant.sku}`
                              : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-slate-700">{formatRp(item.amount)}</p>
                          <p className="text-xs text-slate-400">{Number(item.qty)} unit</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Dialog ─────────────────────────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) resetCreate();
          setCreateOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              {createStep === "search" ? "Buat Refund — Cari Transaksi" : "Buat Refund — Pilih Item"}
            </DialogTitle>
          </DialogHeader>

          {createStep === "search" ? (
            /* Step 1: search transaction by ID */
            <form onSubmit={handleSearchTx} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="tx-id">
                  ID Transaksi <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="tx-id"
                    placeholder="Masukkan ID transaksi (UUID)..."
                    value={txIdInput}
                    onChange={(e) => { setTxIdInput(e.target.value); setTxSearchError(""); }}
                    className="font-mono text-sm"
                    autoFocus
                  />
                  <Button type="submit" disabled={txSearchLoading || !txIdInput.trim()} className="shrink-0 gap-2">
                    <Search className="w-4 h-4" />
                    {txSearchLoading ? "Mencari..." : "Cari"}
                  </Button>
                </div>
                <p className="text-xs text-slate-400">
                  Salin ID dari halaman Transaksi. Hanya transaksi berstatus <strong>Selesai</strong> yang dapat direfund.
                </p>
              </div>
              {txSearchError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  {txSearchError}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { resetCreate(); setCreateOpen(false); }}>
                  Batal
                </Button>
              </DialogFooter>
            </form>
          ) : (
            /* Step 2: select items and qty */
            <form onSubmit={handleSubmitRefund} className="space-y-4">
              {/* Transaction summary */}
              {foundTx && (
                <div className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Invoice</span>
                    <span className="font-mono text-xs font-medium">
                      {foundTx.invoice_no ?? foundTx.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total Transaksi</span>
                    <span className="font-semibold">
                      {formatRp(foundTx.total_amount ?? foundTx.total ?? foundTx.subtotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="space-y-1.5">
                <Label>Item yang Direfund</Label>
                <p className="text-xs text-slate-400">
                  Isi kolom "Qty Refund". Kosongkan untuk tidak merefund item tersebut.
                </p>
                <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {(foundTx?.items ?? []).length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Tidak ada item dalam transaksi ini</p>
                  ) : (
                    (foundTx?.items ?? []).map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {item.ProductVariant?.Product?.name ?? "-"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.ProductVariant?.name ?? ""}
                            {item.ProductVariant?.sku ? ` · ${item.ProductVariant.sku}` : ""}
                            {" · "}
                            Beli: <strong>{Number(item.qty)}</strong> @{formatRp(item.price)}
                          </p>
                        </div>
                        <div className="w-24 shrink-0">
                          <Input
                            type="number"
                            min="0"
                            max={Number(item.qty)}
                            placeholder="0"
                            value={itemQtys[item.id] ?? ""}
                            onChange={(e) =>
                              setItemQtys((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-8 text-sm text-center"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label htmlFor="reason">
                  Alasan <span className="text-xs text-slate-400 font-normal">(opsional)</span>
                </Label>
                <Input
                  id="reason"
                  placeholder="cth. Barang cacat, salah ukuran..."
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>

              {/* Refund total preview */}
              {(foundTx?.items ?? []).some((item) => Number(itemQtys[item.id]) > 0) && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm flex items-center justify-between">
                  <span className="text-red-700">Estimasi Total Refund</span>
                  <span className="font-bold text-red-700">
                    {formatRp(
                      (foundTx?.items ?? []).reduce((sum, item) => {
                        const qty = Number(itemQtys[item.id]) || 0;
                        return sum + qty * parseFloat(String(item.price));
                      }, 0)
                    )}
                  </span>
                </div>
              )}

              {createError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  {createError}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateStep("search")}
                  disabled={createLoading}
                >
                  Kembali
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Memproses..." : "Proses Refund"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
