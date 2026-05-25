"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Warehouse,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  History,
  AlertTriangle,
  PackagePlus,
  Search,
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

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
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

type InventoryItem = {
  id: string;
  shop_id: string;
  Shop?: { id: string; name: string };
  product_variant_id: string;
  ProductVariant?: {
    id: string;
    name: string;
    sku?: string;
    price?: string | number;
    Product?: { id: string; name: string; category?: { name: string } };
  };
  stock: number | string;
  low_stock_threshold: number | string;
  updated_at?: string;
};

type MovementType =
  | "restock"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "sale"
  | "refund";

type Movement = {
  id: string;
  type: MovementType;
  qty: number | string;
  cost_price?: string | number | null;
  note?: string | null;
  created_at: string;
  ProductVariant?: {
    name: string;
    sku?: string;
    Product?: { name: string };
  };
  user?: { name: string };
};

type View = "stock" | "movements";

type ProdFlat = {
  id: string;
  name: string;
  variants?: Array<{ id: string; name: string; sku?: string; price?: string | number }>;
};

type InitRow = {
  variantId: string;
  variantName: string;
  productName: string;
  sku: string;
};

interface InventoryPageProps {
  role: "superadmin" | "admin" | "user";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<MovementType, string> = {
  restock: "Restock",
  adjustment: "Penyesuaian",
  transfer_in: "Transfer Masuk",
  transfer_out: "Transfer Keluar",
  sale: "Penjualan",
  refund: "Refund",
};

const MOVEMENT_COLORS: Record<MovementType, string> = {
  restock: "bg-green-100 text-green-700",
  adjustment: "bg-orange-100 text-orange-700",
  transfer_in: "bg-blue-100 text-blue-700",
  transfer_out: "bg-purple-100 text-purple-700",
  sale: "bg-slate-100 text-slate-600",
  refund: "bg-red-100 text-red-700",
};

// ─── InventoryPage ────────────────────────────────────────────────────────────

export function InventoryPage({ role }: InventoryPageProps) {
  const { toast } = useToast();
  const user = getUser();
  const canEdit = role !== "user";

  const [view, setView] = useState<View>("stock");
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [movLoading, setMovLoading] = useState(false);
  const [error, setError] = useState("");
  const [invSearch, setInvSearch] = useState("");
  const [movType, setMovType] = useState<string>("");
  const [movPage, setMovPage] = useState(1);
  const [movTotal, setMovTotal] = useState(1);

  // Restock dialog
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockCost, setRestockCost] = useState("");
  const [restockNote, setRestockNote] = useState("");
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockError, setRestockError] = useState("");

  // Adjustment out dialog
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjTarget, setAdjTarget] = useState<InventoryItem | null>(null);
  const [adjQty, setAdjQty] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjLoading, setAdjLoading] = useState(false);
  const [adjError, setAdjError] = useState("");

  // Threshold dialog
  const [threshOpen, setThreshOpen] = useState(false);
  const [threshTarget, setThreshTarget] = useState<InventoryItem | null>(null);
  const [threshValue, setThreshValue] = useState("");
  const [threshLoading, setThreshLoading] = useState(false);
  const [threshError, setThreshError] = useState("");

  // Init stock dialog
  const [initOpen, setInitOpen] = useState(false);
  const [initRows, setInitRows] = useState<InitRow[]>([]);
  const [initFetchLoading, setInitFetchLoading] = useState(false);
  const [initSearch, setInitSearch] = useState("");
  const [draftStock, setDraftStock] = useState<Record<string, { qty: string; cost: string }>>({});
  const [initSubmitting, setInitSubmitting] = useState(false);
  const [initProgress, setInitProgress] = useState<{ done: number; total: number } | null>(null);
  const [initError, setInitError] = useState("");

  // ─── Fetchers ────────────────────────────────────────────────────────────────

  const fetchInventory = useCallback(async (shopId: string) => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ data: unknown }>(
        `/api/inventory?shopId=${shopId}&page=1&limit=200`,
      );
      setInventory(extractList<InventoryItem>(res.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMovements = useCallback(async (shopId: string, type: string, pg: number) => {
    if (!shopId) return;
    setMovLoading(true);
    try {
      const params = new URLSearchParams({ shopId, page: String(pg), limit: "30" });
      if (type) params.set("type", type);
      const res = await api.get<{ data: unknown; meta?: Record<string, number> }>(
        `/api/inventory/movements?${params}`,
      );
      setMovements(extractList<Movement>(res.data));
      setMovTotal(res.meta?.totalPages ?? 1);
    } catch {
      setMovements([]);
    } finally {
      setMovLoading(false);
    }
  }, []);

  // Mount: for user with shopId in cookie use it directly; for others fetch shop list
  useEffect(() => {
    if (role === "user" && user?.shopId) {
      setSelectedShopId(user.shopId);
    } else {
      // superadmin, admin, or user without shopId cookie → fetch shop list
      api
        .get<{ data: unknown }>("/api/shops?page=1&limit=100")
        .then((res) => {
          const list = extractList<Shop>(res.data);
          setShops(list);
          if (list.length > 0) setSelectedShopId(list[0].id);
          else setLoading(false);
        })
        .catch(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch inventory whenever selectedShopId is resolved
  useEffect(() => {
    if (selectedShopId) fetchInventory(selectedShopId);
  }, [selectedShopId, fetchInventory]);

  // Movements: fetch when tab switches, shopId, or type filter changes (page handled in buttons)
  useEffect(() => {
    if (view === "movements" && selectedShopId) {
      setMovPage(1);
      fetchMovements(selectedShopId, movType, 1);
    }
  }, [view, selectedShopId, movType, fetchMovements]);

  // ─── Restock ─────────────────────────────────────────────────────────────────

  function openRestock(item: InventoryItem) {
    setRestockTarget(item);
    setRestockQty("");
    setRestockCost("");
    setRestockNote("");
    setRestockError("");
    setRestockOpen(true);
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!restockTarget) return;
    setRestockLoading(true);
    setRestockError("");
    try {
      await api.post("/api/inventory/restock", {
        shop_id: restockTarget.shop_id,
        product_variant_id: restockTarget.product_variant_id,
        qty: Number(restockQty),
        cost_price: Number(restockCost),
        note: restockNote || undefined,
      });
      toast({ title: `Restock ${Number(restockQty)} unit berhasil`, variant: "success" });
      setRestockOpen(false);
      fetchInventory(selectedShopId);
    } catch (err) {
      setRestockError(err instanceof Error ? err.message : "Gagal restock");
    } finally {
      setRestockLoading(false);
    }
  }

  // ─── Adjustment Out ───────────────────────────────────────────────────────────

  function openAdj(item: InventoryItem) {
    setAdjTarget(item);
    setAdjQty("");
    setAdjNote("");
    setAdjError("");
    setAdjOpen(true);
  }

  async function handleAdj(e: React.FormEvent) {
    e.preventDefault();
    if (!adjTarget) return;
    setAdjLoading(true);
    setAdjError("");
    try {
      await api.post("/api/inventory/adjustment-out", {
        shop_id: adjTarget.shop_id,
        product_variant_id: adjTarget.product_variant_id,
        qty: Number(adjQty),
        note: adjNote || undefined,
      });
      toast({ title: `Stok dikurangi ${Number(adjQty)} unit`, variant: "success" });
      setAdjOpen(false);
      fetchInventory(selectedShopId);
    } catch (err) {
      setAdjError(err instanceof Error ? err.message : "Gagal penyesuaian stok");
    } finally {
      setAdjLoading(false);
    }
  }

  // ─── Threshold ────────────────────────────────────────────────────────────────

  function openThresh(item: InventoryItem) {
    setThreshTarget(item);
    setThreshValue(String(item.low_stock_threshold ?? ""));
    setThreshError("");
    setThreshOpen(true);
  }

  async function handleThresh(e: React.FormEvent) {
    e.preventDefault();
    if (!threshTarget) return;
    setThreshLoading(true);
    setThreshError("");
    try {
      await api.patch(`/api/inventory/${threshTarget.id}/threshold`, {
        low_stock_threshold: Number(threshValue),
      });
      toast({ title: "Batas stok minimum diperbarui", variant: "success" });
      setThreshOpen(false);
      fetchInventory(selectedShopId);
    } catch (err) {
      setThreshError(err instanceof Error ? err.message : "Gagal mengubah threshold");
    } finally {
      setThreshLoading(false);
    }
  }

  // ─── Init Stock ──────────────────────────────────────────────────────────────

  async function openInitStock() {
    setInitOpen(true);
    setInitError("");
    setInitProgress(null);
    setInitSearch("");
    setInitFetchLoading(true);
    try {
      const res = await api.get<{ data: unknown }>(
        "/api/products?page=1&limit=200&isActive=true",
      );
      const products = extractList<ProdFlat>(res.data);
      const rows: InitRow[] = [];
      const draft: Record<string, { qty: string; cost: string }> = {};
      for (const p of products) {
        for (const v of p.variants ?? []) {
          rows.push({
            variantId: v.id,
            variantName: v.name,
            productName: p.name,
            sku: v.sku ?? "",
          });
          draft[v.id] = { qty: "", cost: "" };
        }
      }
      setInitRows(rows);
      setDraftStock(draft);
    } catch (err) {
      setInitError(err instanceof Error ? err.message : "Gagal memuat produk");
    } finally {
      setInitFetchLoading(false);
    }
  }

  async function handleInitStock() {
    const shopId = selectedShopId;
    if (!shopId) {
      setInitError("Pilih toko terlebih dahulu");
      return;
    }
    const toProcess = initRows.filter((r) => Number(draftStock[r.variantId]?.qty) > 0);
    if (toProcess.length === 0) {
      setInitError("Masukkan jumlah stok untuk minimal satu varian");
      return;
    }
    setInitSubmitting(true);
    setInitError("");
    setInitProgress({ done: 0, total: toProcess.length });
    let done = 0;
    let failed = 0;
    for (const row of toProcess) {
      const d = draftStock[row.variantId];
      try {
        await api.post("/api/inventory/restock", {
          shop_id: shopId,
          product_variant_id: row.variantId,
          qty: Number(d.qty),
          cost_price: Number(d.cost) || 0,
          note: "Initial stock",
        });
      } catch {
        failed++;
      }
      done++;
      setInitProgress({ done, total: toProcess.length });
    }
    setInitSubmitting(false);
    if (failed > 0) {
      setInitError(
        `${done - failed} varian berhasil, ${failed} gagal. Cek kembali dan ulangi.`,
      );
    } else {
      toast({ title: `${done} varian stok awal berhasil disimpan`, variant: "success" });
      setInitOpen(false);
      fetchInventory(shopId);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const effectiveShopId = selectedShopId;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={canEdit ? "Kelola stok dan pergerakan barang" : "Stok barang toko (read-only)"}
        action={
          <div className="flex items-center gap-2">
            {(role === "superadmin" || role === "admin") && shops.length > 0 && (
              <Select
                value={selectedShopId}
                onValueChange={(v) => setSelectedShopId(v ?? "")}
              >
                <SelectTrigger className="w-48">
                  <span className="truncate text-sm">
                    {shops.find((s) => s.id === selectedShopId)?.name ??
                      "Pilih toko..."}
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
            )}
            {canEdit && effectiveShopId && (
              <Button variant="outline" className="gap-2" onClick={openInitStock}>
                <PackagePlus className="w-4 h-4" />
                Stok Awal
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(
          [
            { key: "stock", label: "Stok", icon: Warehouse },
            { key: "movements", label: "Riwayat Pergerakan", icon: History },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              view === key
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-slate-500 hover:text-slate-700",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Stock view */}
      {view === "stock" && (
        <>
        {/* Stock search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari produk atau SKU..."
            value={invSearch}
            onChange={(e) => setInvSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <table className="w-full">
              <tbody>
                <TableSkeleton cols={canEdit ? 7 : 6} rows={5} />
              </tbody>
            </table>
          ) : inventory.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title={effectiveShopId ? "Belum ada stok di toko ini" : "Pilih toko terlebih dahulu"}
              description={
                effectiveShopId && canEdit
                  ? "Gunakan \"Stok Awal\" untuk mengisi stok pertama kali"
                  : undefined
              }
              action={
                effectiveShopId && canEdit ? (
                  <Button variant="outline" className="gap-2" onClick={openInitStock}>
                    <PackagePlus className="w-4 h-4" />
                    Inisialisasi Stok Awal
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
                    <TableHead>Produk</TableHead>
                    <TableHead>Varian / SKU</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Min. Stok</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && (
                      <TableHead className="text-right w-44">Aksi</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory
                    .filter((item) => {
                      if (!invSearch.trim()) return true;
                      const q = invSearch.toLowerCase();
                      return (
                        item.ProductVariant?.Product?.name?.toLowerCase().includes(q) ||
                        item.ProductVariant?.name?.toLowerCase().includes(q) ||
                        item.ProductVariant?.sku?.toLowerCase().includes(q)
                      );
                    })
                    .map((item, i) => {
                    const stock = Number(item.stock);
                    const threshold = Number(item.low_stock_threshold);
                    const isLow = stock <= threshold;
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <TableCell className="text-center tabular-nums text-slate-400">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.ProductVariant?.Product?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-700">
                            {item.ProductVariant?.name ?? "-"}
                          </p>
                          <p className="text-xs font-mono text-slate-400">
                            {item.ProductVariant?.sku ?? ""}
                          </p>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums font-semibold",
                            isLow ? "text-red-600" : "text-slate-900",
                          )}
                        >
                          {stock}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-500">
                          {threshold}
                        </TableCell>
                        <TableCell>
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              Stok Rendah
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                              Normal
                            </span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs gap-1 h-7 text-green-700 hover:bg-green-50 hover:text-green-800"
                                onClick={() => openRestock(item)}
                              >
                                <ArrowUp className="w-3 h-3" />
                                Restock
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs gap-1 h-7 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                                onClick={() => openAdj(item)}
                              >
                                <ArrowDown className="w-3 h-3" />
                                Keluar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 text-slate-500 hover:bg-slate-50"
                                onClick={() => openThresh(item)}
                                title="Atur batas minimum stok"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        </>
      )}

      {/* Movements view */}
      {view === "movements" && (
        <>
        {/* Movement type filter */}
        <div className="flex items-center gap-3">
          <Select
            value={movType}
            onValueChange={(v) => { setMovType(v ?? ""); setMovPage(1); }}
          >
            <SelectTrigger className="w-44">
              <span className="text-sm">
                {movType ? MOVEMENT_LABELS[movType as MovementType] ?? movType : "Semua Tipe"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Tipe</SelectItem>
              <SelectItem value="restock">Restock</SelectItem>
              <SelectItem value="sale">Penjualan</SelectItem>
              <SelectItem value="refund">Refund</SelectItem>
              <SelectItem value="transfer_in">Transfer Masuk</SelectItem>
              <SelectItem value="transfer_out">Transfer Keluar</SelectItem>
              <SelectItem value="adjustment">Penyesuaian</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {movLoading ? (
            <table className="w-full">
              <tbody>
                <TableSkeleton cols={7} rows={5} />
              </tbody>
            </table>
          ) : movements.length === 0 ? (
            <EmptyState
              icon={History}
              title={effectiveShopId ? "Belum ada riwayat pergerakan stok" : "Pilih toko terlebih dahulu"}
              description={effectiveShopId ? "Riwayat akan muncul setelah ada aktivitas restock, penjualan, atau penyesuaian" : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-3">
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Produk / Varian</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Harga Modal</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((mov, i) => (
                    <TableRow key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <TableCell className="text-center tabular-nums text-slate-400">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">
                          {mov.ProductVariant?.Product?.name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {mov.ProductVariant?.name ?? ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            MOVEMENT_COLORS[mov.type] ?? "bg-slate-100 text-slate-600",
                          )}
                        >
                          {MOVEMENT_LABELS[mov.type] ?? mov.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {Number(mov.qty)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-slate-500">
                        {mov.cost_price ? formatRp(Number(mov.cost_price)) : "-"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm max-w-36 truncate">
                        {mov.note ?? "-"}
                      </TableCell>
                      <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                        {formatDate(mov.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Pagination
          page={movPage}
          totalPages={movTotal}
          pageSize={30}
          onPageChange={(newPg) => {
            setMovPage(newPg);
            fetchMovements(selectedShopId, movType, newPg);
          }}
        />
        </>
      )}

      {/* ── Restock Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restock Barang</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-medium">
              {restockTarget?.ProductVariant?.Product?.name}
            </span>{" "}
            — {restockTarget?.ProductVariant?.name}
          </p>
          <form onSubmit={handleRestock} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rs-qty">
                Jumlah Masuk <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rs-qty"
                type="number"
                min="1"
                placeholder="cth. 50"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                required
                autoFocus
              />
              {restockQty && Number(restockQty) > 0 && (
                <p className="text-xs text-green-600">
                  Stok setelah restock:{" "}
                  <strong>{Number(restockTarget?.stock ?? 0) + Number(restockQty)}</strong>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-cost">
                Harga Modal / unit <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rs-cost"
                type="number"
                min="0"
                placeholder="cth. 2500"
                value={restockCost}
                onChange={(e) => setRestockCost(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-note">
                Catatan <span className="text-xs text-slate-400 font-normal">(opsional)</span>
              </Label>
              <Input
                id="rs-note"
                placeholder="cth. Restock dari supplier"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
              />
            </div>
            {restockError && (
              <p className="text-sm text-red-600">{restockError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRestockOpen(false)} disabled={restockLoading}>
                Batal
              </Button>
              <Button type="submit" disabled={restockLoading}>
                {restockLoading ? "Menyimpan..." : "Simpan Restock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Adjustment Out Dialog ────────────────────────────────────────────── */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Penyesuaian Stok Keluar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-medium">
              {adjTarget?.ProductVariant?.Product?.name}
            </span>{" "}
            — {adjTarget?.ProductVariant?.name}
            <span className="ml-2 text-slate-400 text-xs">
              (Stok saat ini: {Number(adjTarget?.stock ?? 0)})
            </span>
          </p>
          <form onSubmit={handleAdj} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adj-qty">
                Jumlah Keluar <span className="text-red-500">*</span>
              </Label>
              <Input
                id="adj-qty"
                type="number"
                min="1"
                max={Number(adjTarget?.stock ?? 9999)}
                placeholder="cth. 5"
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                required
                autoFocus
              />
              {adjQty && Number(adjQty) > 0 && (
                <p className={cn(
                  "text-xs",
                  Number(adjTarget?.stock ?? 0) - Number(adjQty) < 0
                    ? "text-red-600"
                    : "text-orange-600"
                )}>
                  Stok setelah pengurangan:{" "}
                  <strong>{Number(adjTarget?.stock ?? 0) - Number(adjQty)}</strong>
                  {Number(adjTarget?.stock ?? 0) - Number(adjQty) < 0 && " (melebihi stok tersedia!)"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-note">Alasan / Catatan</Label>
              <Input
                id="adj-note"
                placeholder="cth. Barang rusak/expired"
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
              />
            </div>
            {adjError && <p className="text-sm text-red-600">{adjError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjOpen(false)} disabled={adjLoading}>
                Batal
              </Button>
              <Button type="submit" disabled={adjLoading} variant="destructive">
                {adjLoading ? "Menyimpan..." : "Kurangi Stok"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Threshold Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={threshOpen} onOpenChange={setThreshOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atur Batas Stok Minimum</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            <span className="font-medium">
              {threshTarget?.ProductVariant?.Product?.name}
            </span>{" "}
            — {threshTarget?.ProductVariant?.name}
          </p>
          <form onSubmit={handleThresh} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="thresh-val">Batas Minimum Stok</Label>
              <Input
                id="thresh-val"
                type="number"
                min="0"
                placeholder="cth. 10"
                value={threshValue}
                onChange={(e) => setThreshValue(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-slate-500">
                Item akan ditandai "Stok Rendah" saat stok ≤ nilai ini.
              </p>
            </div>
            {threshError && (
              <p className="text-sm text-red-600">{threshError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setThreshOpen(false)} disabled={threshLoading}>
                Batal
              </Button>
              <Button type="submit" disabled={threshLoading}>
                {threshLoading ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Init Stock Dialog ────────────────────────────────────────────────── */}
      <Dialog
        open={initOpen}
        onOpenChange={(open) => {
          if (!initSubmitting) setInitOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-amber-600" />
              Inisialisasi Stok Awal
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              Toko:{" "}
              <span className="font-medium text-slate-700">
                {shops.find((s) => s.id === effectiveShopId)?.name ??
                  effectiveShopId ??
                  "-"}
              </span>
              . Isi kolom <strong>Qty</strong> dan{" "}
              <strong>Harga Modal</strong> untuk setiap varian yang ingin
              ditambahkan. Varian dengan Qty kosong akan dilewati.
            </p>
          </DialogHeader>

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <Input
              className="pl-8"
              placeholder="Cari produk atau SKU..."
              value={initSearch}
              onChange={(e) => setInitSearch(e.target.value)}
              disabled={initFetchLoading}
            />
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg min-h-0">
            {initFetchLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                Memuat produk...
              </div>
            ) : initRows.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                Belum ada produk aktif
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">
                      Produk
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">
                      Varian
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">
                      SKU
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 w-28">
                      Qty Awal
                    </th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 w-36">
                      Harga Modal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initRows
                    .filter((r) => {
                      if (!initSearch.trim()) return true;
                      const q = initSearch.toLowerCase();
                      return (
                        r.productName.toLowerCase().includes(q) ||
                        r.variantName.toLowerCase().includes(q) ||
                        r.sku.toLowerCase().includes(q)
                      );
                    })
                    .map((r) => (
                      <tr key={r.variantId} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">
                          {r.productName}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {r.variantName}
                        </td>
                        <td className="px-4 py-2 text-slate-400 font-mono text-xs">
                          {r.sku || "-"}
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="h-8 text-sm"
                            value={draftStock[r.variantId]?.qty ?? ""}
                            onChange={(e) =>
                              setDraftStock((prev) => ({
                                ...prev,
                                [r.variantId]: {
                                  ...prev[r.variantId],
                                  qty: e.target.value,
                                },
                              }))
                            }
                            disabled={initSubmitting}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="h-8 text-sm"
                            value={draftStock[r.variantId]?.cost ?? ""}
                            onChange={(e) =>
                              setDraftStock((prev) => ({
                                ...prev,
                                [r.variantId]: {
                                  ...prev[r.variantId],
                                  cost: e.target.value,
                                },
                              }))
                            }
                            disabled={initSubmitting}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Summary row */}
          {!initFetchLoading && (
            <p className="text-xs text-slate-400 shrink-0">
              {
                Object.values(draftStock).filter((d) => Number(d.qty) > 0)
                  .length
              }{" "}
              dari {initRows.length} varian akan diproses
            </p>
          )}

          {/* Progress */}
          {initProgress && (
            <div className="shrink-0 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Memproses...</span>
                <span>
                  {initProgress.done} / {initProgress.total}
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{
                    width: `${(initProgress.done / initProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {initError && (
            <p className="text-sm text-red-600 shrink-0">{initError}</p>
          )}

          <DialogFooter className="shrink-0">
            <Button
              variant="outline"
              onClick={() => setInitOpen(false)}
              disabled={initSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleInitStock}
              disabled={
                initSubmitting ||
                initFetchLoading ||
                Object.values(draftStock).every((d) => !Number(d.qty))
              }
              className="gap-2"
            >
              <PackagePlus className="w-4 h-4" />
              {initSubmitting
                ? `Menyimpan ${initProgress?.done ?? 0}/${initProgress?.total ?? 0}...`
                : "Simpan Stok Awal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
