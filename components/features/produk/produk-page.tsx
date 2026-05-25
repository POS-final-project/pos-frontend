"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  ScanBarcode,
} from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FileInput } from "@/components/ui/file-input";

// Handles both { data: T[] } and { data: { data: T[] } } response shapes
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

type Category = { id: string; name: string };

function normalizeCategory(data: unknown): Category | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const rawId = obj.id;
  if (typeof rawId !== "string" || !rawId.trim()) return null;

  const rawName = obj.name ?? obj.category_name ?? obj.title;
  const name = typeof rawName === "string" && rawName.trim() ? rawName : rawId;

  return { id: rawId, name };
}

type Variant = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: string | number; // API returns price as string "7000.00"
  image_url?: string | null;
  is_active?: boolean;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  Category?: Category; // API returns "Category" (capital C)
  category?: Category; // fallback
  is_active?: boolean;
  variants?: Variant[];
};

type VariantForm = {
  name: string;
  sku: string;
  barcode: string;
  price: string;
  image: File | null;
};

const emptyVariant = (): VariantForm => ({
  name: "",
  sku: "",
  barcode: "",
  price: "",
  image: null,
});

function formatRp(n: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(parseFloat(String(n)));
}

interface ProdukPageProps {
  canEdit?: boolean;
}

export function ProdukPage({ canEdit = true }: ProdukPageProps) {
  const { toast } = useToast();
  const pathname = usePathname();
  // derive role prefix: /superadmin | /admin | /user
  const prefix = pathname.startsWith("/superadmin")
    ? "/superadmin"
    : pathname.startsWith("/admin")
      ? "/admin"
      : "/user";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prodSearch, setProdSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [prodPage, setProdPage] = useState(1);
  const [prodTotal, setProdTotal] = useState(1);
  const [prodCount, setProdCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef("");

  // Create/Edit Product dialog
  const [productDialog, setProductDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formCategoryName, setFormCategoryName] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formVariants, setFormVariants] = useState<VariantForm[]>([
    emptyVariant(),
  ]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Add Variant dialog (for existing product)
  const [variantDialog, setVariantDialog] = useState(false);
  const [variantProductId, setVariantProductId] = useState("");
  const [variantProductName, setVariantProductName] = useState("");
  const [variantForm, setVariantForm] = useState<VariantForm>(emptyVariant());
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState("");

  // Delete Product dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const selectedCategoryInList = categories.find(
    (c) => c.id === formCategoryId,
  );
  const selectedCategoryName =
    formCategoryId === ""
      ? "Tanpa kategori"
      : selectedCategoryInList?.name || formCategoryName || "Kategori saat ini";

  const fetchProducts = useCallback(async (term: string, cat: string, pg: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "20" });
      if (term.trim()) params.set("search", term.trim());
      if (cat) params.set("categoryId", cat);
      const prodRes = await api.get<{ success: boolean; data: unknown; meta?: Record<string, number> }>(
        `/api/products?${params}`,
      );
      setProducts(extractList<Product>(prodRes.data));
      setProdTotal(prodRes.meta?.totalPages ?? 1);
      setProdCount(prodRes.meta?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    const [, catRes] = await Promise.all([
      fetchProducts("", "", 1),
      api.get<{ success: boolean; data: unknown }>(
        "/api/categories?page=1&limit=100",
      ),
    ]);
    setCategories(
      extractList<unknown>(catRes.data)
        .map(normalizeCategory)
        .filter((c): c is Category => Boolean(c)),
    );
  }, [fetchProducts]);

  // Mount
  useEffect(() => {
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref in sync
  useEffect(() => { searchRef.current = prodSearch; });

  // Category filter change — reset page and fetch
  const isFirstCatRender = useRef(true);
  useEffect(() => {
    if (isFirstCatRender.current) { isFirstCatRender.current = false; return; }
    setProdPage(1);
    fetchProducts(searchRef.current, catFilter, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catFilter]);

  function handleProdSearch(val: string) {
    setProdSearch(val);
    setProdPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProducts(val, catFilter, 1);
    }, 350);
  }

  function openCreate() {
    setEditProduct(null);
    setFormName("");
    setFormDesc("");
    setFormCategoryId("");
    setFormCategoryName("");
    setFormIsActive(true);
    setFormVariants([emptyVariant()]);
    setFormError("");
    setProductDialog(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setFormName(p.name);
    setFormDesc(p.description ?? "");
    setFormCategoryId(p.category_id ?? p.Category?.id ?? p.category?.id ?? "");
    setFormCategoryName(p.Category?.name ?? p.category?.name ?? "");
    setFormIsActive(p.is_active !== false);
    setFormVariants([emptyVariant()]);
    setFormError("");
    setProductDialog(true);
  }

  function addVariantRow() {
    setFormVariants((v) => [...v, emptyVariant()]);
  }

  function removeVariantRow(i: number) {
    setFormVariants((v) => v.filter((_, idx) => idx !== i));
  }

  function updateVariantRow(
    i: number,
    field: keyof VariantForm,
    value: string | File | null,
  ) {
    setFormVariants((v) =>
      v.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
    );
  }

  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      if (editProduct) {
        await api.patch(`/api/products/${editProduct.id}`, {
          name: formName,
          description: formDesc,
          category_id: formCategoryId || undefined,
          is_active: formIsActive,
        });
        toast({ title: "Produk diperbarui", variant: "success" });
      } else {
        const validVariants = formVariants.filter(
          (v) => v.name.trim() && v.sku.trim() && v.price,
        );
        if (validVariants.length === 0) {
          setFormError(
            "Tambahkan minimal satu variant dengan nama, SKU, dan harga.",
          );
          setFormLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("name", formName);
        if (formDesc.trim()) {
          formData.append("description", formDesc);
        }
        if (formCategoryId) {
          formData.append("category_id", formCategoryId);
        }

        validVariants.forEach((v, i) => {
          formData.append(`variants[${i}][name]`, v.name.trim());
          formData.append(`variants[${i}][sku]`, v.sku.trim());
          if (v.barcode.trim()) formData.append(`variants[${i}][barcode]`, v.barcode.trim());
          formData.append(`variants[${i}][price]`, v.price);
          if (v.image) {
            formData.append(`variants[${i}][image]`, v.image);
          }
        });

        await api.post("/api/products", formData);
        toast({ title: "Produk ditambahkan", variant: "success" });
      }
      setProductDialog(false);
      fetchAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setFormLoading(false);
    }
  }

  function openAddVariant(p: Product) {
    setVariantProductId(p.id);
    setVariantProductName(p.name);
    setVariantForm(emptyVariant());
    setVariantError("");
    setVariantDialog(true);
  }

  async function handleVariantSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVariantError("");
    setVariantLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", variantForm.name.trim());
      formData.append("sku", variantForm.sku.trim());
      if (variantForm.barcode.trim()) formData.append("barcode", variantForm.barcode.trim());
      formData.append("price", variantForm.price);
      if (variantForm.image) {
        formData.append("image", variantForm.image);
      }

      await api.post(`/api/products/${variantProductId}/variants`, formData);
      toast({ title: "Variant ditambahkan", variant: "success" });
      setVariantDialog(false);
      fetchAll();
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setVariantLoading(false);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/products/${deleteTarget.id}`);
      toast({ title: "Produk dihapus", variant: "success" });
      setDeleteDialog(false);
      fetchAll();
    } catch (err) {
      toast({
        title: "Gagal menghapus produk",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
      setDeleteDialog(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produk"
        description="Kelola produk dan variantnya"
        count={loading ? undefined : prodCount}
        action={
          canEdit ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Produk
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari nama produk..."
            value={prodSearch}
            onChange={(e) => handleProdSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={catFilter || "__all"} onValueChange={(v) => setCatFilter(v === "__all" ? "" : (v ?? ""))}>
          <SelectTrigger className="w-44">
            <span className="text-sm">
              {catFilter ? (categories.find((c) => c.id === catFilter)?.name ?? "Semua Kategori") : "Semua Kategori"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Semua Kategori</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>
              <TableSkeleton cols={canEdit ? 6 : 5} rows={5} />
            </tbody>
          </table>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Belum ada produk"
            description={canEdit ? "Tambahkan produk beserta variantnya untuk mulai berjualan" : "Produk belum tersedia"}
            action={
              canEdit ? (
                <Button onClick={openCreate} variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Tambah Produk
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-8" />
                <TableHead>Nama Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <Fragment key={p.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                    onClick={() =>
                      setExpandedId(expandedId === p.id ? null : p.id)
                    }
                  >
                    <TableCell>
                      {expandedId === p.id ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`${prefix}/produk/${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-slate-900 hover:text-amber-600 hover:underline inline-flex items-center gap-1"
                      >
                        {p.name}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {p.Category?.name ??
                        p.category?.name ??
                        categories.find((c) => c.id === p.category_id)?.name ??
                        "-"}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {p.variants?.length ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.is_active !== false ? "default" : "secondary"
                        }
                      >
                        {p.is_active !== false ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openAddVariant(p)}
                            title="Tambah Variant"
                            className="text-slate-500 hover:text-amber-600"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(p)}
                            className="text-slate-500 hover:text-amber-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setDeleteTarget(p);
                              setDeleteDialog(true);
                            }}
                            className="text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  {expandedId === p.id &&
                    p.variants &&
                    p.variants.length > 0 && (
                      <TableRow
                        key={`${p.id}-variants`}
                        className="bg-slate-50 hover:bg-slate-50"
                      >
                        <TableCell />
                        <TableCell
                          colSpan={canEdit ? 5 : 4}
                          className="pb-3 pt-1"
                        >
                          <div className="rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                  <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Variant
                                  </th>
                                  <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    SKU
                                  </th>
                                  <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Barcode
                                  </th>
                                  <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Harga
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {p.variants.map((v) => (
                                  <tr key={v.id} className="hover:bg-slate-50/60">
                                    <td className="px-3 py-2.5 font-medium text-slate-800">
                                      {v.name}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400">
                                      {v.sku}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400">
                                      {v.barcode ?? <span className="text-slate-200">—</span>}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-semibold text-amber-700 tabular-nums">
                                      {formatRp(v.price)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={prodPage}
        totalPages={prodTotal}
        total={prodCount}
        pageSize={20}
        onPageChange={(newPg) => {
          setProdPage(newPg);
          fetchProducts(prodSearch, catFilter, newPg);
        }}
      />

      {/* Create / Edit Product Dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editProduct ? "Edit Produk" : "Tambah Produk"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleProductSubmit} className="space-y-5 pt-1">
            {/* ── Informasi Produk ──────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Informasi Produk
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="p-name">
                  Nama Produk <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="p-name"
                  placeholder="cth. Aqua 600ml"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  autoFocus={!editProduct}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="p-desc">
                  Deskripsi{" "}
                  <span className="text-xs font-normal text-slate-400">(opsional)</span>
                </Label>
                <Input
                  id="p-desc"
                  placeholder="Deskripsi singkat produk"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              <div className={cn("gap-3", editProduct ? "grid grid-cols-2" : "")}>
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Select
                    value={formCategoryId || "__none"}
                    onValueChange={(v) =>
                      setFormCategoryId(!v || v === "__none" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori...">
                        {selectedCategoryName}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Tanpa kategori</SelectItem>
                      {formCategoryId && !selectedCategoryInList && (
                        <SelectItem value={formCategoryId}>
                          {formCategoryName || "Kategori saat ini"}
                        </SelectItem>
                      )}
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {editProduct && (
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormIsActive(true)}
                        className={cn(
                          "flex-1 h-9 rounded-lg border text-sm transition-colors",
                          formIsActive
                            ? "bg-green-50 border-green-400 text-green-700 font-medium"
                            : "border-slate-200 text-slate-500 hover:border-slate-300",
                        )}
                      >
                        Aktif
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormIsActive(false)}
                        className={cn(
                          "flex-1 h-9 rounded-lg border text-sm transition-colors",
                          !formIsActive
                            ? "bg-red-50 border-red-300 text-red-600 font-medium"
                            : "border-slate-200 text-slate-500 hover:border-slate-300",
                        )}
                      >
                        Nonaktif
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Varian (create only) ──────────────────────────────── */}
            {!editProduct && (
              <>
                <div className="border-t border-slate-100" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      Varian Produk
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addVariantRow}
                      className="h-7 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    >
                      <Plus className="w-3 h-3" />
                      Tambah Baris
                    </Button>
                  </div>

                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {formVariants.map((v, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 bg-white overflow-hidden"
                      >
                        {/* Top: number badge + nama + harga + delete */}
                        <div className="flex items-end gap-2.5 px-3 pt-3 pb-2.5">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-600 mb-0.5">
                            {i + 1}
                          </span>
                          <div className="flex-1 grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-slate-500">Nama Variant</Label>
                              <Input
                                placeholder="cth. Default"
                                value={v.name}
                                onChange={(e) => updateVariantRow(i, "name", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-slate-500">Harga (Rp)</Label>
                              <Input
                                type="number"
                                placeholder="3000"
                                value={v.price}
                                onChange={(e) => updateVariantRow(i, "price", e.target.value)}
                                className="h-8 text-sm"
                                min={0}
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeVariantRow(i)}
                            className="flex-shrink-0 text-slate-300 hover:text-red-400 mb-0.5"
                            disabled={formVariants.length === 1}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {/* Bottom: SKU + barcode + image */}
                        <div className="grid grid-cols-3 gap-2.5 px-3 pb-3 pt-2.5 border-t border-slate-100 bg-slate-50/50">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500">SKU</Label>
                            <Input
                              placeholder="AQU-DEF"
                              value={v.sku}
                              onChange={(e) => updateVariantRow(i, "sku", e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500 flex items-center gap-1">
                              Barcode
                              <ScanBarcode className="w-2.5 h-2.5 text-slate-400" />
                            </Label>
                            <Input
                              placeholder="8991234..."
                              value={v.barcode}
                              onChange={(e) => updateVariantRow(i, "barcode", e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-slate-500">Foto</Label>
                            <FileInput
                              accept="image/*"
                              compact
                              onChange={(file) => updateVariantRow(i, "image", file)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-400">
                    Wajib mengisi <strong>Nama</strong>, <strong>Harga</strong>, dan <strong>SKU</strong> untuk setiap variant.
                  </p>
                </div>
              </>
            )}

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setProductDialog(false)}
                disabled={formLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading
                  ? "Menyimpan..."
                  : editProduct
                    ? "Simpan Perubahan"
                    : "Tambah Produk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Variant Dialog */}
      <Dialog open={variantDialog} onOpenChange={setVariantDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Variant</DialogTitle>
            {variantProductName && (
              <p className="text-sm text-slate-500">{variantProductName}</p>
            )}
          </DialogHeader>
          <form onSubmit={handleVariantSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>
                Nama Variant <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="cth. Large / Merah / 500ml"
                value={variantForm.name}
                onChange={(e) =>
                  setVariantForm((v) => ({ ...v, name: e.target.value }))
                }
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  SKU <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="AQU-600-LG"
                  value={variantForm.sku}
                  onChange={(e) =>
                    setVariantForm((v) => ({ ...v, sku: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Harga <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={variantForm.price}
                  onChange={(e) =>
                    setVariantForm((v) => ({ ...v, price: e.target.value }))
                  }
                  required
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Barcode
                <span className="text-xs font-normal text-slate-400">(opsional)</span>
                <ScanBarcode className="w-3.5 h-3.5 text-slate-400 ml-auto" />
              </Label>
              <Input
                placeholder="Scan atau ketik barcode..."
                value={variantForm.barcode}
                onChange={(e) =>
                  setVariantForm((v) => ({ ...v, barcode: e.target.value }))
                }
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              />
              <p className="text-xs text-slate-400">
                Fokus ke kolom ini lalu scan dengan barcode scanner
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>
                Foto{" "}
                <span className="text-xs font-normal text-slate-400">(opsional)</span>
              </Label>
              <FileInput
                accept="image/*"
                onChange={(file) => setVariantForm((v) => ({ ...v, image: file }))}
              />
            </div>

            {variantError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {variantError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantDialog(false)}
                disabled={variantLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={variantLoading}>
                {variantLoading ? "Menyimpan..." : "Tambah Variant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Produk</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Hapus produk <strong>{deleteTarget?.name}</strong>? Seluruh variant
            dan data terkait juga akan dihapus.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(false)}
              disabled={deleteLoading}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
