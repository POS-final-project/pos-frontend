"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
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
  price: string;
  image: File | null;
};

const emptyVariant = (): VariantForm => ({
  name: "",
  sku: "",
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get<{ success: boolean; data: unknown }>(
          "/api/products?page=1&limit=100",
        ),
        api.get<{ success: boolean; data: unknown }>(
          "/api/categories?page=1&limit=100",
        ),
      ]);
      setProducts(extractList<Product>(prodRes.data));
      setCategories(
        extractList<unknown>(catRes.data)
          .map(normalizeCategory)
          .filter((c): c is Category => Boolean(c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
  }, [fetchAll]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Produk</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola produk dan variantnya
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah Produk
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

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
                        className="font-medium text-slate-900 hover:text-indigo-600 hover:underline inline-flex items-center gap-1"
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
                            className="text-slate-500 hover:text-indigo-600"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(p)}
                            className="text-slate-500 hover:text-indigo-600"
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
                                <tr className="bg-slate-100">
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    Variant
                                  </th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    SKU
                                  </th>
                                  <th className="text-left px-3 py-2 font-medium text-slate-600">
                                    Harga
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.variants.map((v) => (
                                  <tr
                                    key={v.id}
                                    className="border-t border-slate-100"
                                  >
                                    <td className="px-3 py-2">{v.name}</td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
                                      {v.sku}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-indigo-700">
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

      {/* Create / Edit Product Dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editProduct ? "Edit Produk" : "Tambah Produk"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProductSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Nama Produk</Label>
                <Input
                  id="p-name"
                  placeholder="cth. Aqua 600ml"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Deskripsi</Label>
              <Input
                id="p-desc"
                placeholder="Deskripsi produk (opsional)"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>

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
                <Label>Status Produk</Label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                  />
                  Aktif
                </label>
              </div>
            )}

            {!editProduct && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Variant</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addVariantRow}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3 h-3" /> Tambah Baris
                  </Button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {formVariants.map((v, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end"
                    >
                      <div className="space-y-1">
                        <Label className="text-xs">Nama</Label>
                        <Input
                          placeholder="Default"
                          value={v.name}
                          onChange={(e) =>
                            updateVariantRow(i, "name", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">SKU</Label>
                        <Input
                          placeholder="AQU-600-DEF"
                          value={v.sku}
                          onChange={(e) =>
                            updateVariantRow(i, "sku", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Harga</Label>
                        <Input
                          type="number"
                          placeholder="3000"
                          value={v.price}
                          onChange={(e) =>
                            updateVariantRow(i, "price", e.target.value)
                          }
                          className="h-8 text-sm"
                          min={0}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Gambar</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            updateVariantRow(
                              i,
                              "image",
                              e.target.files?.[0] ?? null,
                            )
                          }
                          className="h-8 text-sm file:text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeVariantRow(i)}
                        className="text-slate-400 hover:text-red-500 mt-auto"
                        disabled={formVariants.length === 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductDialog(false)} disabled={formLoading}>
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
            <DialogTitle>Tambah Variant — {variantProductName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVariantSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Variant</Label>
              <Input
                placeholder="cth. Large"
                value={variantForm.name}
                onChange={(e) =>
                  setVariantForm((v) => ({ ...v, name: e.target.value }))
                }
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>SKU Variant</Label>
              <Input
                placeholder="cth. AQU-600-LG"
                value={variantForm.sku}
                onChange={(e) =>
                  setVariantForm((v) => ({ ...v, sku: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Harga</Label>
              <Input
                type="number"
                placeholder="3000"
                value={variantForm.price}
                onChange={(e) =>
                  setVariantForm((v) => ({ ...v, price: e.target.value }))
                }
                required
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gambar (Opsional)</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setVariantForm((v) => ({
                    ...v,
                    image: e.target.files?.[0] ?? null,
                  }))
                }
              />
            </div>
            {variantError && (
              <p className="text-sm text-red-600">{variantError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVariantDialog(false)} disabled={variantLoading}>
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
