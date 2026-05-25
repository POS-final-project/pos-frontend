"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeftRight,
  Plus,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Ban,
  Search,
  PackageSearch,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (obj.data && typeof obj.data === "object") {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.items)) return inner.items as T[];
    }
  }
  return [];
}

function formatDate(s?: string | null): string {
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

// ─── Types ────────────────────────────────────────────────────────────────────

type Shop = { id: string; name: string };

type TransferStatus = "pending" | "approved" | "rejected" | "cancelled";

type Transfer = {
  id: string;
  from_shop_id: string;
  to_shop_id: string;
  fromShop?: Shop;
  toShop?: Shop;
  status: TransferStatus;
  note?: string | null;
  created_at: string;
  requester?: { id: string; name: string };
};

type TransferItemApi = {
  id: string;
  product_variant_id: string;
  ProductVariant?: {
    id: string;
    name: string;
    sku?: string;
    Product?: { id: string; name: string };
  };
  qty: number | string;
  note?: string | null;
};

type ProductVariant = { id: string; name: string; sku?: string };
type Product = { id: string; name: string; variants?: ProductVariant[] };

// Draft item for create dialog
type DraftItem = {
  variantId: string;
  variantName: string;
  productName: string;
  qty: number;
  note: string;
};

type Tab = "outgoing" | "incoming";

interface TransferPageProps {
  role: "superadmin" | "admin";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TransferStatus, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};

const STATUS_CLASS: Record<TransferStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  approved: "bg-green-50 text-green-700 border border-green-200",
  rejected: "bg-red-50 text-red-700 border border-red-200",
  cancelled: "bg-slate-100 text-slate-500 border border-slate-200",
};

// ─── TransferPage ─────────────────────────────────────────────────────────────

export function TransferPage({ role }: TransferPageProps) {
  const { toast } = useToast();
  const user = getUser();

  const [tab, setTab] = useState<Tab>("outgoing");
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>(
    role === "superadmin" ? "" : (user?.shopId ?? ""),
  );
  const [outgoing, setOutgoing] = useState<Transfer[]>([]);
  const [incoming, setIncoming] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [outPage, setOutPage] = useState(1);
  const [inPage, setInPage] = useState(1);
  const [outTotal, setOutTotal] = useState(1);
  const [inTotal, setInTotal] = useState(1);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTransfer, setDetailTransfer] = useState<Transfer | null>(null);
  const [detailItems, setDetailItems] = useState<TransferItemApi[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "approve" | "reject" | "cancel";
    transfer: Transfer;
  } | null>(null);

  // Create transfer dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createFromShop, setCreateFromShop] = useState<string>(
    role === "superadmin" ? "" : (user?.shopId ?? ""),
  );
  const [createToShop, setCreateToShop] = useState<string>("");
  const [createNote, setCreateNote] = useState<string>("");
  const [createItems, setCreateItems] = useState<DraftItem[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Product search (within create dialog)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [itemQty, setItemQty] = useState<string>("1");
  const [itemNote, setItemNote] = useState<string>("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fetchers ──────────────────────────────────────────────────────────────

  const fetchTransfers = useCallback(
    async (shopId: string, status: string, outPg: number, inPg: number) => {
      setLoading(true);
      setError("");
      try {
        const shopParam = shopId ? `shopId=${shopId}&` : "";
        const statusParam = status ? `status=${status}&` : "";
        const [outRes, inRes] = await Promise.all([
          api.get<{ data: unknown; meta?: Record<string, number> }>(
            `/api/transfers/outgoing?${shopParam}${statusParam}page=${outPg}&limit=20`,
          ),
          api.get<{ data: unknown; meta?: Record<string, number> }>(
            `/api/transfers/incoming?${shopParam}${statusParam}page=${inPg}&limit=20`,
          ),
        ]);
        setOutgoing(extractList<Transfer>(outRes.data));
        setIncoming(extractList<Transfer>(inRes.data));
        setOutTotal(outRes.meta?.totalPages ?? 1);
        setInTotal(inRes.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat transfer");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchShops = useCallback(async () => {
    try {
      const res = await api.get<{ data: unknown }>(
        "/api/shops?page=1&limit=100",
      );
      const list = extractList<Shop>(res.data);
      setShops(list);
      if (role === "superadmin" && !selectedShopId) {
        // don't auto-select for superadmin — show all by default
      }
      return list;
    } catch {
      return [] as Shop[];
    }
  }, [role, selectedShopId]);

  // Mount
  useEffect(() => {
    const init = async () => {
      await fetchShops();
      fetchTransfers(role === "superadmin" ? "" : (user?.shopId ?? ""), "", 1, 1);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when shopId changes (superadmin filter)
  useEffect(() => {
    if (role === "superadmin") {
      setOutPage(1);
      setInPage(1);
      fetchTransfers(selectedShopId, statusFilter, 1, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShopId, role, fetchTransfers]);

  // Status filter changes — reset pages and refetch both tabs
  useEffect(() => {
    setOutPage(1);
    setInPage(1);
    fetchTransfers(selectedShopId, statusFilter, 1, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // ─── Product search (debounced) ─────────────────────────────────────────────

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get<{ data: unknown }>(
          `/api/products?search=${encodeURIComponent(searchQuery)}&page=1&limit=20`,
        );
        setSearchResults(extractList<Product>(res.data));
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery]);

  // ─── Detail dialog ─────────────────────────────────────────────────────────

  async function openDetail(transfer: Transfer) {
    setDetailTransfer(transfer);
    setDetailItems([]);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: unknown }>(
        `/api/transfers/${transfer.id}/items`,
      );
      setDetailItems(extractList<TransferItemApi>(res.data));
    } catch {
      setDetailItems([]);
    } finally {
      setDetailLoading(false);
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleAction(
    type: "approve" | "reject" | "cancel",
    transferId: string,
  ) {
    setActionLoading(transferId + type);
    try {
      await api.patch(`/api/transfers/${transferId}/${type}`, {});
      const actionLabel = type === "approve" ? "diterima" : type === "reject" ? "ditolak" : "dibatalkan";
      toast({ title: `Transfer berhasil ${actionLabel}`, variant: "success" });
      setConfirmDialog(null);
      fetchTransfers(selectedShopId || (user?.shopId ?? ""), statusFilter, outPage, inPage);
    } catch (err) {
      toast({
        title: "Aksi gagal",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
      setConfirmDialog(null);
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Create transfer ───────────────────────────────────────────────────────

  function addDraftItem() {
    if (!selectedProduct || !selectedVariantId || Number(itemQty) < 1) return;
    const variant = selectedProduct.variants?.find(
      (v) => v.id === selectedVariantId,
    );
    if (!variant) return;
    setCreateItems((prev) => {
      const existing = prev.find((i) => i.variantId === selectedVariantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === selectedVariantId
            ? { ...i, qty: i.qty + Number(itemQty) }
            : i,
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          variantName: variant.name,
          productName: selectedProduct.name,
          qty: Number(itemQty),
          note: itemNote,
        },
      ];
    });
    setSelectedProduct(null);
    setSelectedVariantId("");
    setItemQty("1");
    setItemNote("");
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeDraftItem(variantId: string) {
    setCreateItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (createItems.length === 0) {
      setCreateError("Tambahkan minimal satu item transfer");
      return;
    }
    if (!createFromShop || !createToShop) {
      setCreateError("Pilih toko asal dan tujuan");
      return;
    }
    if (createFromShop === createToShop) {
      setCreateError("Toko asal dan tujuan tidak boleh sama");
      return;
    }
    setCreateLoading(true);
    setCreateError("");
    try {
      await api.post("/api/transfers", {
        from_shop_id: createFromShop,
        to_shop_id: createToShop,
        note: createNote || undefined,
        items: createItems.map((i) => ({
          product_variant_id: i.variantId,
          qty: i.qty,
          note: i.note || undefined,
        })),
      });
      toast({ title: "Transfer stok berhasil dibuat", variant: "success" });
      setCreateOpen(false);
      resetCreateForm();
      setOutPage(1);
      setInPage(1);
      fetchTransfers(selectedShopId || (user?.shopId ?? ""), statusFilter, 1, 1);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal membuat transfer");
    } finally {
      setCreateLoading(false);
    }
  }

  function resetCreateForm() {
    setCreateFromShop(role === "superadmin" ? "" : (user?.shopId ?? ""));
    setCreateToShop("");
    setCreateNote("");
    setCreateItems([]);
    setCreateError("");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedProduct(null);
    setSelectedVariantId("");
    setItemQty("1");
    setItemNote("");
  }

  function openCreate() {
    resetCreateForm();
    setCreateOpen(true);
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  const effectiveShopId = selectedShopId || user?.shopId || "";
  const list = tab === "outgoing" ? outgoing : incoming;

  function renderRows(transfers: Transfer[]) {
    return transfers.map((t, i) => {
      const isPending = t.status === "pending";
      const isOut = tab === "outgoing";
      return (
        <TableRow key={t.id} className="hover:bg-slate-50/70 transition-colors">
          <TableCell className="text-center tabular-nums text-slate-400">
            {i + 1}
          </TableCell>
          <TableCell>
            <p className="font-medium text-sm">{t.fromShop?.name ?? t.from_shop_id}</p>
            <p className="text-xs text-slate-400">Asal</p>
          </TableCell>
          <TableCell>
            <p className="font-medium text-sm">{t.toShop?.name ?? t.to_shop_id}</p>
            <p className="text-xs text-slate-400">Tujuan</p>
          </TableCell>
          <TableCell>
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                STATUS_CLASS[t.status],
              )}
            >
              {STATUS_LABEL[t.status]}
            </span>
          </TableCell>
          <TableCell className="text-slate-500 text-sm max-w-32 truncate">
            {t.note ?? "-"}
          </TableCell>
          <TableCell className="text-slate-400 text-xs whitespace-nowrap">
            {formatDate(t.created_at)}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-slate-500"
                onClick={() => openDetail(t)}
              >
                <Eye className="w-3 h-3" />
                Detail
              </Button>
              {isPending && isOut && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-slate-500 hover:text-red-600"
                  onClick={() => setConfirmDialog({ type: "cancel", transfer: t })}
                  disabled={actionLoading !== null}
                >
                  <Ban className="w-3 h-3" />
                  Batal
                </Button>
              )}
              {isPending && !isOut && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-green-700 hover:bg-green-50"
                    onClick={() => setConfirmDialog({ type: "approve", transfer: t })}
                    disabled={actionLoading !== null}
                  >
                    <CheckCircle className="w-3 h-3" />
                    Terima
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-red-600 hover:bg-red-50"
                    onClick={() => setConfirmDialog({ type: "reject", transfer: t })}
                    disabled={actionLoading !== null}
                  >
                    <XCircle className="w-3 h-3" />
                    Tolak
                  </Button>
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      );
    });
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfer Stok"
        description="Kelola transfer stok antar toko"
        action={
          <div className="flex items-center gap-3">
            {role === "superadmin" && shops.length > 0 && (
              <Select
                value={selectedShopId}
                onValueChange={(v) => setSelectedShopId(v ?? "")}
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
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Buat Transfer
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { key: "outgoing", label: "Transfer Keluar" },
            { key: "incoming", label: "Transfer Masuk" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === key
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-700",
            )}
          >
            <ArrowLeftRight className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <span className="text-sm">
              {statusFilter ? STATUS_LABEL[statusFilter as TransferStatus] : "Semua Status"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua Status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
            <SelectItem value="cancelled">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>
              <TableSkeleton cols={7} rows={5} />
            </tbody>
          </table>
        ) : list.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={tab === "outgoing" ? "Belum ada transfer keluar" : "Belum ada transfer masuk"}
            description={
              tab === "outgoing"
                ? "Buat transfer stok untuk mengirim barang ke toko lain"
                : "Transfer masuk akan muncul di sini saat toko lain mengirim stok ke toko Anda"
            }
            action={
              tab === "outgoing" ? (
                <Button onClick={openCreate} variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Buat Transfer
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-3">
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Dari Toko</TableHead>
                  <TableHead>Ke Toko</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right w-52">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{renderRows(list)}</TableBody>
            </Table>
          </div>
        )}
      </div>

      <Pagination
        page={tab === "outgoing" ? outPage : inPage}
        totalPages={tab === "outgoing" ? outTotal : inTotal}
        pageSize={20}
        onPageChange={(newPg) => {
          if (tab === "outgoing") {
            setOutPage(newPg);
            fetchTransfers(selectedShopId || (user?.shopId ?? ""), statusFilter, newPg, inPage);
          } else {
            setInPage(newPg);
            fetchTransfers(selectedShopId || (user?.shopId ?? ""), statusFilter, outPage, newPg);
          }
        }}
      />

      {/* ── Detail Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Transfer</DialogTitle>
          </DialogHeader>
          {detailTransfer && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Dari Toko</p>
                  <p className="font-medium">
                    {detailTransfer.fromShop?.name ?? detailTransfer.from_shop_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Ke Toko</p>
                  <p className="font-medium">
                    {detailTransfer.toShop?.name ?? detailTransfer.to_shop_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Status</p>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      STATUS_CLASS[detailTransfer.status],
                    )}
                  >
                    {STATUS_LABEL[detailTransfer.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Tanggal</p>
                  <p>{formatDate(detailTransfer.created_at)}</p>
                </div>
                {detailTransfer.note && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-0.5">Catatan</p>
                    <p>{detailTransfer.note}</p>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Item Transfer</p>
                {detailLoading ? (
                  <p className="text-sm text-slate-400 text-center py-4">Memuat...</p>
                ) : detailItems.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    Tidak ada item
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detailItems.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-sm bg-slate-50 px-3 py-2 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {it.ProductVariant?.Product?.name ?? "-"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {it.ProductVariant?.name ?? ""}{" "}
                            {it.ProductVariant?.sku
                              ? `· ${it.ProductVariant.sku}`
                              : ""}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums">
                          {Number(it.qty)} pcs
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirm Action Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={confirmDialog !== null}
        onOpenChange={() => setConfirmDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.type === "approve"
                ? "Terima Transfer"
                : confirmDialog?.type === "reject"
                  ? "Tolak Transfer"
                  : "Batalkan Transfer"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {confirmDialog?.type === "approve" &&
              "Stok akan bertambah di toko penerima. Konfirmasi penerimaan transfer ini?"}
            {confirmDialog?.type === "reject" &&
              "Transfer akan ditolak dan stok tidak berubah. Lanjutkan?"}
            {confirmDialog?.type === "cancel" &&
              "Transfer akan dibatalkan. Tindakan ini tidak bisa dibatalkan."}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              disabled={actionLoading !== null}
            >
              Kembali
            </Button>
            <Button
              variant={
                confirmDialog?.type === "approve" ? "default" : "destructive"
              }
              disabled={actionLoading !== null}
              onClick={() => {
                if (confirmDialog)
                  handleAction(confirmDialog.type, confirmDialog.transfer.id);
              }}
            >
              {actionLoading !== null
                ? "Memproses..."
                : confirmDialog?.type === "approve"
                  ? "Ya, Terima"
                  : confirmDialog?.type === "reject"
                    ? "Ya, Tolak"
                    : "Ya, Batalkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Transfer Dialog ───────────────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) resetCreateForm();
          setCreateOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Transfer Stok</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* From / To shop */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dari Toko</Label>
                {role === "superadmin" ? (
                  <Select
                    value={createFromShop}
                    onValueChange={(v) => setCreateFromShop(v ?? "")}
                  >
                    <SelectTrigger>
                      <span className="truncate text-sm">
                        {createFromShop
                          ? (shops.find((s) => s.id === createFromShop)?.name ?? createFromShop)
                          : "Pilih toko asal..."}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {shops.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm font-medium py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
                    {shops.find((s) => s.id === user?.shopId)?.name ??
                      user?.shopId ??
                      "-"}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Ke Toko</Label>
                <Select
                  value={createToShop}
                  onValueChange={(v) => setCreateToShop(v ?? "")}
                >
                  <SelectTrigger>
                    <span className="truncate text-sm">
                      {createToShop
                        ? (shops.find((s) => s.id === createToShop)?.name ?? createToShop)
                        : "Pilih toko tujuan..."}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {shops
                      .filter((s) => s.id !== createFromShop)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tr-note">Catatan Transfer (opsional)</Label>
              <Input
                id="tr-note"
                placeholder="cth. Transfer stok mingguan"
                value={createNote}
                onChange={(e) => setCreateNote(e.target.value)}
              />
            </div>

            {/* Item picker */}
            <div className="space-y-3">
              <Label>Tambah Item</Label>
              <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-slate-50">
                {/* Product search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    className="pl-8 bg-white"
                    placeholder="Cari produk..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedProduct(null);
                      setSelectedVariantId("");
                    }}
                  />
                </div>

                {/* Search results dropdown */}
                {!selectedProduct && searchResults.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm max-h-52 overflow-y-auto">
                    {searchLoading ? (
                      <p className="text-sm text-slate-400 px-3 py-2">Mencari...</p>
                    ) : (
                      searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 hover:text-amber-700 transition-colors"
                          onClick={() => {
                            setSelectedProduct(p);
                            setSearchQuery(p.name);
                            setSelectedVariantId(
                              p.variants?.length === 1 ? p.variants[0].id : "",
                            );
                          }}
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Variant select */}
                {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 1 && (
                  <Select
                    value={selectedVariantId}
                    onValueChange={(v) => setSelectedVariantId(v ?? "")}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Pilih varian..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct.variants.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name} {v.sku ? `(${v.sku})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Qty + item note row */}
                <div className="flex gap-2">
                  <div className="w-24">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      className="bg-white"
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder="Catatan item (opsional)"
                    className="bg-white flex-1"
                    value={itemNote}
                    onChange={(e) => setItemNote(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={!selectedProduct || !selectedVariantId || Number(itemQty) < 1}
                    onClick={addDraftItem}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Draft items list */}
              {createItems.length > 0 && (
                <div className="space-y-1.5">
                  {createItems.map((it) => (
                    <div
                      key={it.variantId}
                      className="flex items-center justify-between text-sm bg-white border border-slate-200 px-3 py-2 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{it.productName}</p>
                        <p className="text-xs text-slate-500">
                          {it.variantName}
                          {it.note ? ` · ${it.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">
                          {it.qty} pcs
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDraftItem(it.variantId)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetCreateForm();
                  setCreateOpen(false);
                }}
                disabled={createLoading}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createLoading || createItems.length === 0}
              >
                {createLoading ? "Memproses..." : "Buat Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
