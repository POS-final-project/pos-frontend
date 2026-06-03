"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReceiptItem = {
  product_name: string;
  variant_name: string;
  sku: string;
  barcode: string | null;
  qty: number;
  price: number;
  subtotal: number;
};

type Receipt = {
  invoice_no: string;
  status: string;
  payment_method: string;
  paid_at: string | null;
  note: string | null;
  subtotal: number;
  created_at: string;
  shop: { name: string; address: string | null; phone: string | null };
  cashier: { name: string };
  customer: { name: string; phone: string | null } | null;
  items: ReceiptItem[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDate(s: string | null | undefined) {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function extractReceipt(raw: unknown): Receipt | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.invoice_no === "string") return obj as unknown as Receipt;
  if (obj.data) return extractReceipt(obj.data);
  return null;
}

const PAYMENT_LABEL: Record<string, string> = { cash: "Tunai", qris: "QRIS" };

// ─── Print helper ─────────────────────────────────────────────────────────────

function buildPrintHtml(receipt: Receipt, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt ${receipt.invoice_no}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      padding: 16px;
      max-width: 300px;
      margin: auto;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .dashed { border-top: 1px dashed #000; margin: 6px 0; }
    .solid { border-top: 1px solid #000; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .muted { color: #555; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; padding-bottom: 3px; border-bottom: 1px solid #000; }
    td { padding: 2px 0; font-size: 11px; vertical-align: top; }
    .td-right { text-align: right; }
    .td-center { text-align: center; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; }
    .footer-text { text-align: center; color: #777; font-size: 10px; margin-top: 14px; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  transactionId: string | null;
  shopId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReceiptModal({ open, onClose, transactionId, shopId }: ReceiptModalProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const printBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !transactionId) return;
    setLoading(true);
    setError("");
    setReceipt(null);
    const params = shopId ? `?shopId=${shopId}` : "";
    api.get<unknown>(`/api/transactions/${transactionId}/receipt${params}`)
      .then(res => {
        const r = extractReceipt(res);
        if (r) setReceipt(r);
        else setError("Format receipt tidak valid");
      })
      .catch(err => setError(err instanceof Error ? err.message : "Gagal memuat receipt"))
      .finally(() => setLoading(false));
  }, [open, transactionId, shopId]);

  function handlePrint() {
    if (!receipt || !printBodyRef.current) return;
    const html = buildPrintHtml(receipt, printBodyRef.current.innerHTML);
    const win = window.open("", "_blank", "width=420,height=700,scrollbars=yes");
    if (!win) {
      alert("Popup diblokir browser. Izinkan popup untuk halaman ini.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-base">Receipt</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Memuat receipt…</div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : receipt ? (
          /* ── Receipt body (also used as print source) ── */
          <div
            ref={printBodyRef}
            className="font-mono text-[12px] text-slate-800 border border-dashed border-slate-200 rounded-lg p-4 bg-white"
          >
            {/* Shop */}
            <div className="text-center mb-3">
              <p className="font-bold text-sm">{receipt.shop.name}</p>
              {receipt.shop.address && (
                <p className="text-[10px] text-slate-500 mt-0.5">{receipt.shop.address}</p>
              )}
              {receipt.shop.phone && (
                <p className="text-[10px] text-slate-500">{receipt.shop.phone}</p>
              )}
            </div>

            <div className="dashed border-t border-dashed border-slate-300 my-2" />

            {/* Meta */}
            <div className="space-y-0.5 text-[11px]">
              <div className="row flex justify-between">
                <span className="text-slate-500">No. Invoice</span>
                <span className="font-bold">{receipt.invoice_no}</span>
              </div>
              <div className="row flex justify-between">
                <span className="text-slate-500">Tanggal</span>
                <span>{formatDate(receipt.paid_at ?? receipt.created_at)}</span>
              </div>
              <div className="row flex justify-between">
                <span className="text-slate-500">Kasir</span>
                <span>{receipt.cashier.name}</span>
              </div>
              {receipt.customer && (
                <div className="row flex justify-between">
                  <span className="text-slate-500">Pelanggan</span>
                  <span>{receipt.customer.name}</span>
                </div>
              )}
              <div className="row flex justify-between">
                <span className="text-slate-500">Pembayaran</span>
                <span>{PAYMENT_LABEL[receipt.payment_method] ?? receipt.payment_method}</span>
              </div>
            </div>

            <div className="dashed border-t border-dashed border-slate-300 my-2" />

            {/* Items */}
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="text-left pb-1 font-medium text-slate-600">Produk</th>
                  <th className="text-center pb-1 font-medium text-slate-600 w-8">Qty</th>
                  <th className="text-right pb-1 font-medium text-slate-600">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-1 pr-2">
                      <p className="font-medium leading-tight">{item.product_name}</p>
                      {item.variant_name !== "Default" && (
                        <p className="text-slate-400 text-[10px]">{item.variant_name}</p>
                      )}
                      <p className="text-slate-400 text-[10px] tabular-nums">
                        {formatRp(item.price)} × {item.qty}
                      </p>
                    </td>
                    <td className="py-1 text-center tabular-nums text-slate-700">{item.qty}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{formatRp(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="solid border-t border-slate-400 my-2" />

            {/* Total */}
            <div className="total-row flex justify-between items-center">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-base font-bold tabular-nums">{formatRp(receipt.subtotal)}</span>
            </div>

            {receipt.note && (
              <>
                <div className="dashed border-t border-dashed border-slate-200 my-2" />
                <p className="text-[10px] text-slate-500">
                  <span className="font-medium">Catatan: </span>{receipt.note}
                </p>
              </>
            )}

            <p className="footer-text text-center text-[10px] text-slate-400 mt-4">
              Terima kasih atas kunjungan Anda
            </p>
          </div>
        ) : null}
        </div>

        <div className="pt-3 border-t border-slate-100 flex-shrink-0">
          <Button
            onClick={handlePrint}
            disabled={!receipt}
            className="w-full gap-2"
          >
            <Printer className="w-4 h-4" />
            Cetak Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
