"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, X,
  LayoutGrid, LayoutList, Package, Loader2, ScanBarcode, Printer,
} from "lucide-react";
import { ReceiptModal } from "@/components/features/transaksi/receipt-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

type Category = { id: string; name: string };

type Variant = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  image_url?: string | null;
  is_active?: boolean;
  Product?: { id: string; name: string };
};

type Product = {
  id: string;
  name: string;
  sku: string;
  category?: Category;
  is_active?: boolean;
  variants?: Variant[];
};

type Customer = { id: string; name: string; phone?: string };
type Shop = { id: string; name: string };

type CartItem = {
  variantId: string;
  productName: string;
  variantName: string;
  price: number;
  qty: number;
  image_url?: string | null;
};

type PaymentMethod = "cash" | "qris";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris: "QRIS",
};

function formatRp(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

interface KasirPageProps {
  role: "superadmin" | "admin" | "user";
}

export function KasirPage({ role }: KasirPageProps) {
  const user = getUser();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [productView, setProductView] = useState<"card" | "list">("card");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string>(user?.shopId ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerDropRect, setCustomerDropRect] = useState({ top: 0, left: 0, width: 0 });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [cashInput, setCashInput] = useState("");

  const [clearConfirm, setClearConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [txError, setTxError] = useState("");
  const [successDialog, setSuccessDialog] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{ id: string; total: number } | null>(null);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeSearching, setBarcodeSearching] = useState(false);
  const [barcodeErr, setBarcodeErr] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [stockMapReady, setStockMapReady] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [prodRes, custRes, catRes, shopRes] = await Promise.all([
        api.get<{ data: unknown }>("/api/products?page=1&limit=200&isActive=true"),
        api.get<{ data: unknown }>("/api/customers?page=1&limit=200"),
        api.get<{ data: unknown }>("/api/categories?page=1&limit=100"),
        api.get<{ data: unknown }>("/api/shops?page=1&limit=100"),
      ]);
      setProducts(extractList<Product>(prodRes.data));
      setCustomers(extractList<Customer>(custRes.data));
      setCategories(extractList<Category>(catRes.data));
      const shopList = extractList<Shop>(shopRes.data);
      setShops(shopList);
      // user: prefer shopId from cookie; fallback to first in list
      // admin/superadmin: auto-select first if nothing chosen yet
      setSelectedShopId((prev) => {
        if (prev) return prev;
        return shopList[0]?.id ?? "";
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus barcode input once loading is done
  useEffect(() => {
    if (!loading) barcodeRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    if (!selectedShopId) { setStockMap({}); setStockMapReady(false); return; }

    type StockItem = { product_variant_id: string; stock: number | string };
    type StockRes = { data: StockItem[]; meta?: { totalPages: number } };

    setStockMapReady(false);
    const fetchAllStock = async () => {
      try {
        const LIMIT = 200;
        const first = await api.get<StockRes>(`/api/inventory?shopId=${selectedShopId}&page=1&limit=${LIMIT}`);
        let all: StockItem[] = first.data ?? [];
        const totalPages = first.meta?.totalPages ?? 1;

        if (totalPages > 1) {
          const pages = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              api.get<StockRes>(`/api/inventory?shopId=${selectedShopId}&page=${i + 2}&limit=${LIMIT}`)
                .then((r) => r.data ?? [])
            )
          );
          all = all.concat(pages.flat());
        }

        const map: Record<string, number> = {};
        all.forEach((item) => { map[item.product_variant_id] = Number(item.stock); });
        setStockMap(map);
      } catch {
        setStockMap({});
      } finally {
        setStockMapReady(true);
      }
    };

    void fetchAllStock();
  }, [selectedShopId]);

  const filteredProducts = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || p.category?.id === categoryFilter;
    return matchSearch && matchCat;
  });

  const sortedVariantList = useMemo(() => {
    const flat: { product: Product; variant: Variant }[] = [];
    for (const product of filteredProducts) {
      for (const variant of product.variants ?? []) {
        flat.push({ product, variant });
      }
    }
    if (!selectedShopId || !stockMapReady) return flat;
    return flat.sort((a, b) => {
      const score = (id: string) => {
        if (!(id in stockMap)) return 3;
        const s = stockMap[id];
        if (s === 0) return 2;
        if (s <= 5) return 1;
        return 0;
      };
      return score(a.variant.id) - score(b.variant.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProducts, stockMap, stockMapReady, selectedShopId]);

  function addToCart(product: Product, variant: Variant) {
    setCart((prev) => {
      const existing = prev.find((c) => c.variantId === variant.id);
      if (existing) {
        return prev.map((c) =>
          c.variantId === variant.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          price: variant.price,
          qty: 1,
          image_url: variant.image_url,
        },
      ];
    });
  }

  function updateQty(variantId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((c) => (c.variantId === variantId ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  function removeFromCart(variantId: string) {
    setCart((prev) => prev.filter((c) => c.variantId !== variantId));
  }

  function clearCart() {
    setCart([]);
    setSelectedCustomerId("");
    setCustomerSearch("");
    setNote("");
    setShowNote(false);
    setCashInput("");
    setPaymentMethod("cash");
  }

  function selectCustomer(id: string, name: string) {
    setSelectedCustomerId(id);
    setCustomerSearch(name);
    setCustomerOpen(false);
  }

  function refocusBarcode() {
    // Use rAF so React has flushed state before we steal focus back
    requestAnimationFrame(() => barcodeRef.current?.focus());
  }

  async function handleBarcodeScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) { refocusBarcode(); return; }
    setBarcodeSearching(true);
    setBarcodeErr("");
    try {
      const res = await api.get<{ data: unknown }>(`/api/products/variants/by-barcode/${encodeURIComponent(trimmed)}`);
      const variant = (res.data as Variant | null) ?? (res as unknown as { data: Variant }).data;
      if (!variant?.id) throw new Error("Produk tidak ditemukan");

      const productName = variant.Product?.name ?? "Produk";
      const stock = selectedShopId ? (stockMap[variant.id] ?? null) : null;
      const notInShopBarcode = selectedShopId && stockMapReady && !(variant.id in stockMap);
      if (notInShopBarcode) {
        setBarcodeErr(`${productName} — tidak tersedia di toko ini`);
        setBarcodeInput("");
        setTimeout(() => setBarcodeErr(""), 3000);
        refocusBarcode();
        return;
      }
      if (stock !== null && stock === 0) {
        setBarcodeErr(`${productName} — stok habis`);
        setBarcodeInput("");
        setTimeout(() => setBarcodeErr(""), 3000);
        refocusBarcode();
        return;
      }

      setCart(prev => {
        const existing = prev.find(c => c.variantId === variant.id);
        if (existing) return prev.map(c => c.variantId === variant.id ? { ...c, qty: c.qty + 1 } : c);
        return [...prev, {
          variantId: variant.id,
          productName,
          variantName: variant.name,
          price: variant.price,
          qty: 1,
          image_url: variant.image_url,
        }];
      });
      setBarcodeInput("");
      refocusBarcode();
    } catch (err) {
      setBarcodeErr(err instanceof Error ? err.message : "Barcode tidak ditemukan");
      setBarcodeInput("");
      setTimeout(() => setBarcodeErr(""), 3000);
      refocusBarcode();
    } finally {
      setBarcodeSearching(false);
    }
  }

  const filteredCustomers = customers.filter(
    (c) =>
      !customerSearch ||
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.phone && c.phone.includes(customerSearch))
  );

  const total = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const change = cashInput ? parseFloat(cashInput) - total : 0;
  const totalQty = cart.reduce((s, c) => s + c.qty, 0);

  async function handleProcess() {
    if (cart.length === 0) return;
    if (!selectedShopId) {
      setTxError("Pilih toko terlebih dahulu.");
      return;
    }
    setProcessing(true);
    setTxError("");
    try {
      const res = await api.post<{ success: boolean; data: { id: string; subtotal: number } }>(
        "/api/transactions",
        {
          shop_id: selectedShopId,
          customer_id: selectedCustomerId || undefined,
          payment_method: paymentMethod,
          note: note || undefined,
          items: cart.map((c) => ({
            product_variant_id: c.variantId,
            qty: c.qty,
            price: c.price,
          })),
        }
      );
      setLastTransaction({ id: res.data.id, total: res.data.subtotal ?? total });
      setSuccessDialog(true);
      setCartOpen(false);
      clearCart();
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Transaksi gagal");
    } finally {
      setProcessing(false);
    }
  }

  /* ── Shared cart JSX (closure over state) ─────────────── */

  const cartItemsList =
    cart.length === 0 ? (
      <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-2">
        <ShoppingCart className="w-8 h-8" />
        <p className="text-xs">Keranjang kosong</p>
      </div>
    ) : (
      <>
        {cart.map((item) => (
          <div key={item.variantId} className="flex items-start gap-2 rounded-lg p-2.5 mb-2 border border-slate-100 bg-white hover:border-amber-200 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
              {item.variantName !== "Default" && (
                <p className="text-xs text-slate-400">{item.variantName}</p>
              )}
              <p className="text-xs font-bold text-amber-600 mt-0.5">{formatRp(item.price)}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon-sm" onClick={() => updateQty(item.variantId, -1)} className="h-6 w-6 text-slate-500">
                <Minus className="w-3 h-3" />
              </Button>
              <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => updateQty(item.variantId, 1)} className="h-6 w-6 text-slate-500">
                <Plus className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => removeFromCart(item.variantId)} className="h-6 w-6 text-red-400 hover:text-red-600">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </>
    );

  const selectedShopName = shops.find((s) => s.id === selectedShopId)?.name ?? "";

  /* Compact settings bar — shop + customer, side-by-side */
  const cartSettingsBar = (
    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 flex-shrink-0">
      <div className={cn("grid gap-2", role !== "user" ? "grid-cols-2" : "grid-cols-1")}>
        {/* Superadmin & admin: shop dropdown. User: shop name label */}
        {role === "superadmin" || role === "admin" ? (
          <div className="space-y-0.5 min-w-0">
            <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Toko</Label>
            <Select value={selectedShopId} onValueChange={(v) => setSelectedShopId(v ?? "")}>
              <SelectTrigger className="h-7 text-xs">
                <span className="truncate text-xs">
                  {selectedShopName || "Pilih..."}
                </span>
              </SelectTrigger>
              <SelectContent>
                {shops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : selectedShopName ? (
          <div className="space-y-0.5 min-w-0 col-span-1 hidden" />
        ) : null}
        <div className="space-y-0.5 min-w-0">
          <Label className="text-[10px] text-slate-400 uppercase tracking-wide">Pelanggan</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            <input
              ref={customerInputRef}
              type="text"
              value={customerSearch}
              placeholder="Cari pelanggan..."
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                if (selectedCustomerId) setSelectedCustomerId("");
              }}
              onFocus={() => {
                const r = customerInputRef.current?.getBoundingClientRect();
                if (r) setCustomerDropRect({ top: r.bottom + 4, left: r.left, width: r.width });
                setCustomerOpen(true);
              }}
              onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
              className={cn(
                "h-7 w-full rounded-md border bg-background pl-6 pr-2 text-xs outline-none transition-colors",
                "border-input focus:border-amber-400 focus:ring-1 focus:ring-amber-400",
                selectedCustomerId && "border-amber-300 bg-amber-50/40"
              )}
            />
            {selectedCustomerId && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectCustomer("", ""); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {customerOpen && (
              <div
                className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
                style={{ top: customerDropRect.top, left: customerDropRect.left, width: Math.max(customerDropRect.width, 200) }}
              >
                <div className="max-h-52 overflow-y-auto">
                  <div
                    className={cn(
                      "px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 text-slate-500 border-b border-slate-100",
                      !selectedCustomerId && "bg-amber-50 text-amber-700"
                    )}
                    onMouseDown={() => selectCustomer("", "")}
                  >
                    Tanpa pelanggan
                  </div>
                  {filteredCustomers.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-slate-400 text-center">
                      Tidak ditemukan
                    </div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "px-3 py-2 text-xs cursor-pointer hover:bg-slate-50",
                          selectedCustomerId === c.id && "bg-amber-50 text-amber-700"
                        )}
                        onMouseDown={() => selectCustomer(c.id, c.name)}
                      >
                        <div className="font-medium">{c.name}</div>
                        {c.phone && <div className="text-slate-400 mt-0.5">{c.phone}</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* Checkout strip — payment + cash + note + total + button */
  const cartCheckoutFooter = (
    <div className="border-t border-slate-200 p-3 flex-shrink-0 space-y-2.5">
      {/* Payment method pills */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setPaymentMethod(k)}
            className={cn(
              "px-3 py-1 text-xs rounded-full border transition-colors",
              paymentMethod === k
                ? "bg-amber-500 text-amber-950 border-amber-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
            )}
          >
            {PAYMENT_LABELS[k]}
          </button>
        ))}
      </div>

      {/* Cash input + change in one row */}
      {paymentMethod === "cash" && cart.length > 0 && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Nominal uang yang diterima"
            value={cashInput}
            onChange={(e) => setCashInput(e.target.value)}
            className="h-8 text-sm flex-1 min-w-0"
            min={0}
          />
          {cashInput && (
            <span className={`text-xs font-medium whitespace-nowrap flex-shrink-0 ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
              Kembali {formatRp(Math.max(0, change))}
            </span>
          )}
        </div>
      )}

      {/* Collapsible note */}
      {showNote ? (
        <Input
          placeholder="Tuliskan catatan untuk transaksi ini"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-8 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="text-xs text-amber-600 hover:underline text-left"
        >
          + Tambah catatan
        </button>
      )}

      {/* Total */}
      <div className="flex items-center justify-between pt-1 border-t border-dashed border-slate-200">
        <span className="font-semibold text-slate-700">Total</span>
        <span className="font-bold text-xl text-amber-700">{formatRp(total)}</span>
      </div>

      {txError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {txError}
        </p>
      )}

      <Button
        onClick={handleProcess}
        disabled={cart.length === 0 || processing || !selectedShopId}
        className="w-full gap-2"
      >
        <CreditCard className="w-4 h-4" />
        {processing ? "Memproses..." : "Proses Transaksi"}
      </Button>
    </div>
  );

  /* ── Render ────────────────────────────────────────────── */

  return (
    <>
      {/* Main layout: stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100dvh-4rem-3rem)] gap-4 min-h-0">

        {/* Left — Product Panel */}
        <div className="flex flex-col flex-1 min-w-0 gap-3 lg:min-h-0">

          {/* Barcode Scanner Input — always active, auto-focused */}
          <div className="space-y-1">
            <div className="relative">
              <ScanBarcode className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                barcodeErr ? "text-red-400" : "text-amber-500",
              )} />
              <input
                ref={barcodeRef}
                type="text"
                autoFocus
                placeholder="Siap scan barcode…"
                value={barcodeInput}
                onChange={(e) => { setBarcodeInput(e.target.value); setBarcodeErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBarcodeScan(barcodeInput); } }}
                disabled={barcodeSearching}
                className={cn(
                  "h-10 w-full rounded-md border bg-background pl-9 pr-8 text-sm outline-none transition-colors",
                  barcodeErr
                    ? "border-red-300 ring-1 ring-red-200"
                    : "border-amber-300 ring-1 ring-amber-100 focus:border-amber-500 focus:ring-amber-200",
                )}
              />
              {barcodeSearching
                ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />
                : <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-amber-400 tracking-wide select-none">AKTIF</span>
              }
            </div>
            {barcodeErr && (
              <p className="text-xs text-red-600 flex items-center gap-1 pl-1">
                <X className="w-3 h-3 flex-shrink-0" />
                {barcodeErr}
              </p>
            )}
          </div>

          {/* Search + Category + View toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                ref={searchRef}
                placeholder="Cari produk atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "")}>
              <SelectTrigger className="w-32 sm:w-36">
                <span className="truncate text-sm">
                  {categoryFilter
                    ? (categories.find((c) => c.id === categoryFilter)?.name ?? "Kategori")
                    : "Semua"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 flex-shrink-0">
              <Button
                variant={productView === "card" ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => setProductView("card")}
                className="h-7 w-7"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant={productView === "list" ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => setProductView("list")}
                className="h-7 w-7"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {loadError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {loadError}
            </div>
          )}

          {/* Scrollable product area — extra bottom padding on mobile for fixed bar */}
          <div className="flex-1 overflow-y-auto pb-20 lg:pb-2">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Memuat...</div>
            ) : sortedVariantList.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Tidak ada produk</div>
            ) : productView === "card" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {sortedVariantList.map(({ product, variant }) => {
                    const stock = selectedShopId ? (stockMap[variant.id] ?? null) : null;
                    const notInShop = selectedShopId && stockMapReady && !(variant.id in stockMap);
                    const outOfStock = notInShop || (stock !== null && stock === 0);
                    const lowStock = !notInShop && stock !== null && stock > 0 && stock <= 5;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => !outOfStock && addToCart(product, variant)}
                        disabled={outOfStock}
                        className={cn(
                          "flex flex-col text-left bg-white border border-slate-200 rounded-xl overflow-hidden transition-all",
                          outOfStock
                            ? "opacity-60 cursor-not-allowed"
                            : "hover:border-amber-400 hover:shadow-sm active:scale-[0.98]"
                        )}
                      >
                        <div className="relative w-full aspect-[4/3] bg-slate-100 flex items-center justify-center">
                          <Package className="w-8 h-8 text-slate-300 absolute" />
                          {variant.image_url && (
                            <img
                              src={`/backend${variant.image_url}`}
                              alt={variant.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          )}
                          {outOfStock && (
                            <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                              <span className="text-white text-xs font-bold tracking-wide bg-slate-800/70 px-2 py-0.5 rounded">
                                {notInShop ? "TDK TERSEDIA" : "HABIS"}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 flex flex-col gap-0.5">
                          <div className="text-xs text-slate-400 font-mono truncate">{variant.sku}</div>
                          <div className="font-medium text-slate-800 text-sm leading-tight line-clamp-2">
                            {product.name}
                          </div>
                          {variant.name !== "Default" && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 w-fit">
                              {variant.name}
                            </Badge>
                          )}
                          <div className="mt-1.5 flex items-center justify-between gap-1">
                            <div className="font-semibold text-amber-700 text-sm">
                              {formatRp(variant.price)}
                            </div>
                            {(stock !== null || notInShop) && (
                              <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
                                outOfStock
                                  ? "bg-red-50 text-red-600 border-red-200"
                                  : lowStock
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-50 text-slate-500 border-slate-200"
                              )}>
                                {notInShop ? "N/A" : outOfStock ? "Habis" : stock}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedVariantList.map(({ product, variant }) => {
                    const stock = selectedShopId ? (stockMap[variant.id] ?? null) : null;
                    const notInShop = selectedShopId && stockMapReady && !(variant.id in stockMap);
                    const outOfStock = notInShop || (stock !== null && stock === 0);
                    const lowStock = !notInShop && stock !== null && stock > 0 && stock <= 5;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => !outOfStock && addToCart(product, variant)}
                        disabled={outOfStock}
                        className={cn(
                          "flex items-center gap-3 text-left bg-white border border-slate-200 rounded-xl p-2.5 transition-all",
                          outOfStock
                            ? "opacity-60 cursor-not-allowed"
                            : "hover:border-amber-400 hover:shadow-sm active:scale-[0.98]"
                        )}
                      >
                        <div className="relative w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <Package className="w-5 h-5 text-slate-300 absolute" />
                          {variant.image_url && (
                            <img
                              src={`/backend${variant.image_url}`}
                              alt={variant.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          )}
                          {outOfStock && (
                            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center rounded-lg">
                              <span className="text-white text-[9px] font-bold">{notInShop ? "N/A" : "HABIS"}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-400 font-mono">{variant.sku}</div>
                          <div className="font-medium text-slate-800 text-sm leading-tight">{product.name}</div>
                          {variant.name !== "Default" && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">{variant.name}</Badge>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <div className="font-semibold text-amber-700 text-sm">
                            {formatRp(variant.price)}
                          </div>
                          {(stock !== null || notInShop) && (
                            <span className={cn(
                              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                              outOfStock
                                ? "bg-red-50 text-red-600 border-red-200"
                                : lowStock
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-50 text-slate-500 border-slate-200"
                            )}>
                              {notInShop ? "Tidak tersedia" : outOfStock ? "Habis" : `Stok ${stock}`}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right — Cart Panel (desktop only) */}
        <div className="hidden lg:flex w-80 xl:w-96 flex-shrink-0 flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Title + clear */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <ShoppingCart className="w-4 h-4" />
              Keranjang
              {cart.length > 0 && <Badge className="text-xs">{totalQty}</Badge>}
            </div>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setClearConfirm(true)}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {/* Shop + customer compact bar */}
          {cartSettingsBar}
          {/* Items — takes all remaining space */}
          <div className="flex-1 overflow-y-auto px-3 py-2">{cartItemsList}</div>
          {/* Payment + total + button */}
          {cartCheckoutFooter}
        </div>
      </div>

      {/* Mobile fixed bottom cart bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-4 py-2.5 flex items-center gap-3">
        {cart.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <ShoppingCart className="w-4 h-4" />
            <span>Keranjang kosong</span>
          </div>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500">{totalQty} item</p>
              <p className="font-bold text-amber-700 text-sm">{formatRp(total)}</p>
            </div>
            <Button onClick={() => setCartOpen(true)} size="sm" className="gap-2 flex-shrink-0">
              <ShoppingCart className="w-4 h-4" />
              Keranjang
              <Badge className="bg-white/20 text-white border-transparent ml-1 text-xs">
                {totalQty}
              </Badge>
            </Button>
          </>
        )}
      </div>

      {/* Mobile Cart Dialog (full-screen on phone, sheet on tablet) */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-none w-screen h-dvh rounded-none p-0 overflow-hidden sm:max-w-md sm:h-auto sm:max-h-[90dvh] sm:rounded-xl"
        >
          <div className="flex flex-col h-full sm:h-auto overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <ShoppingCart className="w-4 h-4" />
                Keranjang
                {cart.length > 0 && <Badge className="text-xs">{totalQty}</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {cart.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={clearCart}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" onClick={() => setCartOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {/* Shop + customer compact bar */}
            {cartSettingsBar}
            {/* Scrollable items */}
            <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">{cartItemsList}</div>
            {/* Payment + total + button */}
            {cartCheckoutFooter}
          </div>
        </DialogContent>
      </Dialog>

      {/* Clear Cart Confirm */}
      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Kosongkan Keranjang</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Hapus semua {totalQty} item dari keranjang?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirm(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setClearConfirm(false); clearCart(); }}
            >
              Kosongkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Processing overlay — prevents double-click during transaction */}
      {processing && (
        <div className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-md px-8 py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-sm font-medium text-slate-700">Memproses transaksi...</p>
            <p className="text-xs text-slate-400">Mohon tunggu sebentar</p>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        transactionId={lastTransaction?.id ?? null}
        shopId={selectedShopId || undefined}
      />

      {/* Success Dialog */}
      <Dialog open={successDialog} onOpenChange={setSuccessDialog}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center text-center pt-2 pb-1 gap-4">
            {/* Checkmark */}
            <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-green-600 mb-1">Transaksi Berhasil</p>
              <p className="text-3xl font-extrabold tracking-tight" style={{ color: "oklch(0.13 0.025 260)" }}>
                {formatRp(lastTransaction?.total ?? 0)}
              </p>
            </div>
            <p className="text-[11px] font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
              {lastTransaction?.id}
            </p>
            <div className="flex gap-2 w-full mt-1">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => { setSuccessDialog(false); setReceiptOpen(true); }}
              >
                <Printer className="w-4 h-4" />
                Cetak Receipt
              </Button>
              <Button onClick={() => setSuccessDialog(false)} className="flex-1">
                Transaksi Baru
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
