"use client";

import { useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

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

// ─── Types ────────────────────────────────────────────────────────────────────

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

export function RefundKasirPage() {
  const { toast } = useToast();

  const [step, setStep] = useState<"search" | "items">("search");
  const [txIdInput, setTxIdInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [foundTx, setFoundTx] = useState<Transaction | null>(null);
  const [itemQtys, setItemQtys] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const id = txIdInput.trim();
    if (!id) return;
    setSearchLoading(true);
    setSearchError("");
    try {
      const res = await api.get<{ data: unknown }>(`/api/transactions/${id}`);
      const tx = (res.data as Record<string, unknown>).data as Transaction;
      if (tx.status !== "completed") {
        setSearchError(
          "Transaksi belum berstatus 'completed' — hanya transaksi yang sudah selesai dapat direfund"
        );
        return;
      }
      setFoundTx(tx);
      const qtys: Record<string, string> = {};
      (tx.items ?? []).forEach((item) => { qtys[item.id] = ""; });
      setItemQtys(qtys);
      setStep("items");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Transaksi tidak ditemukan");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!foundTx) return;
    const items = (foundTx.items ?? [])
      .filter((item) => Number(itemQtys[item.id]) > 0)
      .map((item) => ({ transaction_item_id: item.id, qty: Number(itemQtys[item.id]) }));
    if (items.length === 0) {
      setSubmitError("Masukkan jumlah refund minimal 1 unit untuk setidaknya satu item");
      return;
    }
    setSubmitLoading(true);
    setSubmitError("");
    try {
      await api.post("/api/refunds", {
        transaction_id: foundTx.id,
        reason: reason.trim() || undefined,
        items,
      });
      toast({ title: "Refund berhasil diproses", description: "Stok barang telah dikembalikan ke inventory", variant: "success" });
      reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Gagal memproses refund");
    } finally {
      setSubmitLoading(false);
    }
  }

  function reset() {
    setStep("search");
    setTxIdInput("");
    setSearchError("");
    setFoundTx(null);
    setItemQtys({});
    setReason("");
    setSubmitError("");
  }

  const estimatedTotal = (foundTx?.items ?? []).reduce((sum, item) => {
    const qty = Number(itemQtys[item.id]) || 0;
    return sum + qty * parseFloat(String(item.price));
  }, 0);
  const hasAnyQty = (foundTx?.items ?? []).some((item) => Number(itemQtys[item.id]) > 0);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Refund</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Proses pengembalian barang dari transaksi yang sudah selesai
        </p>
      </div>

      {step === "search" ? (
        /* ── Step 1: Search ──────────────────────────────────────────── */
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="font-medium text-slate-800 text-sm">Cari Transaksi</p>
              <p className="text-xs text-slate-400">Masukkan ID transaksi yang ingin direfund</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-id">
                ID Transaksi <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="tx-id"
                  placeholder="Masukkan ID transaksi (UUID)..."
                  value={txIdInput}
                  onChange={(e) => { setTxIdInput(e.target.value); setSearchError(""); }}
                  className="font-mono text-sm"
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={searchLoading || !txIdInput.trim()}
                  className="shrink-0 gap-2"
                >
                  <Search className="w-4 h-4" />
                  {searchLoading ? "Mencari..." : "Cari"}
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                Salin ID dari halaman Transaksi. Hanya transaksi berstatus{" "}
                <strong>Selesai</strong> yang dapat direfund.
              </p>
            </div>

            {searchError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {searchError}
              </div>
            )}
          </form>
        </div>
      ) : (
        /* ── Step 2: Select items ────────────────────────────────────── */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Transaction summary card */}
          {foundTx && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">Transaksi Ditemukan</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {foundTx.invoice_no ?? foundTx.id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Toko</p>
                  <p className="font-medium">{foundTx.Shop?.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Tanggal</p>
                  <p>{formatDate(foundTx.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Total</p>
                  <p className="font-semibold">
                    {formatRp(foundTx.total_amount ?? foundTx.total ?? foundTx.subtotal)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div>
              <p className="font-medium text-slate-800 text-sm">Pilih Item yang Direfund</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Isi kolom &ldquo;Qty Refund&rdquo;. Kosongkan untuk tidak merefund item tersebut.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {(foundTx?.items ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  Tidak ada item dalam transaksi ini
                </p>
              ) : (
                (foundTx?.items ?? []).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50/70 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {item.ProductVariant?.Product?.name ?? "-"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.ProductVariant?.name ?? ""}
                        {item.ProductVariant?.sku ? ` · ${item.ProductVariant.sku}` : ""}
                        {" · "}
                        Beli: <strong>{Number(item.qty)}</strong> @{formatRp(item.price)}
                      </p>
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      <p className="text-[10px] text-slate-400 mb-1">Qty Refund</p>
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
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2">
            <Label htmlFor="reason">
              Alasan{" "}
              <span className="text-xs text-slate-400 font-normal">(opsional)</span>
            </Label>
            <Input
              id="reason"
              placeholder="cth. Barang cacat, salah ukuran..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Refund total preview */}
          {hasAnyQty && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <span className="text-sm text-red-700 font-medium">Estimasi Total Refund</span>
              <span className="font-bold text-red-700 text-base">{formatRp(estimatedTotal)}</span>
            </div>
          )}

          {submitError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" variant="outline" onClick={reset} disabled={submitLoading}>
              Kembali
            </Button>
            <Button type="submit" disabled={submitLoading || !hasAnyQty} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              {submitLoading ? "Memproses..." : "Proses Refund"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
