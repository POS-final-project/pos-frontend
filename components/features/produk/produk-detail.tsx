"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

function extractItem<T>(data: unknown): T | null {
  if (!data || typeof data !== "object") return null;
  // { data: { id, ... } }
  const inner = (data as Record<string, unknown>).data;
  if (inner && typeof inner === "object" && !Array.isArray(inner))
    return inner as T;
  // { id, ... } directly
  if ("id" in (data as object)) return data as T;
  return null;
}

function formatRp(n: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(parseFloat(String(n)));
}

// Routes image through Next.js /backend proxy so no CORS issue and no direct backend URL needed
function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `/backend${url}`;
  return `/backend/uploads/product-variant/${url}`;
}

type Category = { id: string; name: string };

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

interface ProdukDetailProps {
  productId: string;
  backHref: string;
  canEdit?: boolean;
}

function VariantImage({ url, name }: { url?: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);
  const resolved = resolveImageUrl(url);

  if (!resolved || imgError) {
    return (
      <div className="w-full aspect-square bg-slate-100 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-300">
        <ImageOff className="w-8 h-8" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={name}
      onError={() => setImgError(true)}
      className="w-full aspect-square object-cover rounded-lg bg-slate-100"
    />
  );
}

export function ProdukDetail({
  productId,
  backHref,
  canEdit = true,
}: ProdukDetailProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add variant dialog
  const [variantDialog, setVariantDialog] = useState(false);
  const [vName, setVName] = useState("");
  const [vSku, setVSku] = useState("");
  const [vPrice, setVPrice] = useState("");
  const [vImageFile, setVImageFile] = useState<File | null>(null);
  const [vLoading, setVLoading] = useState(false);
  const [vError, setVError] = useState("");

  // Edit variant dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [evName, setEvName] = useState("");
  const [evPrice, setEvPrice] = useState("");
  const [evIsActive, setEvIsActive] = useState(true);
  const [evImageFile, setEvImageFile] = useState<File | null>(null);
  const [evLoading, setEvLoading] = useState(false);
  const [evError, setEvError] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteVariantTarget, setDeleteVariantTarget] = useState<Variant | null>(null);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ success: boolean; data: unknown }>(
        `/api/products/${productId}`,
      );
      // API: { success, data: { id, name, Category, variants, ... } }
      const p = extractItem<Product>(res.data);
      if (!p) throw new Error("Produk tidak ditemukan");
      setProduct(p);

      // Variants are included in the product detail response
      if (p.variants && p.variants.length > 0) {
        setVariants(p.variants);
      } else {
        const vRes = await api.get<{ success: boolean; data: unknown }>(
          `/api/products/${productId}/variants?page=1&limit=100`,
        );
        setVariants(extractList<Variant>(vRes.data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    setVError("");
    setVLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", vName);
      formData.append("sku", vSku);
      formData.append("price", vPrice);
      if (vImageFile) {
        formData.append("image", vImageFile);
      }

      await api.post(`/api/products/${productId}/variants`, formData);
      setVariantDialog(false);
      setVName("");
      setVSku("");
      setVPrice("");
      setVImageFile(null);
      fetchProduct();
    } catch (err) {
      setVError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setVLoading(false);
    }
  }

  function openEditVariant(variant: Variant) {
    setEditingVariant(variant);
    setEvName(variant.name);
    setEvPrice(String(variant.price));
    setEvIsActive(variant.is_active !== false);
    setEvImageFile(null);
    setEvError("");
    setEditDialog(true);
  }

  async function handleEditVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVariant) return;

    setEvError("");
    setEvLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", evName);
      formData.append("price", evPrice);
      formData.append("is_active", String(evIsActive));
      if (evImageFile) {
        formData.append("image", evImageFile);
      }

      await api.patch(
        `/api/products/${productId}/variants/${editingVariant.id}`,
        formData,
      );

      setEditDialog(false);
      setEditingVariant(null);
      fetchProduct();
    } catch (err) {
      setEvError(
        err instanceof Error ? err.message : "Gagal memperbarui variant",
      );
    } finally {
      setEvLoading(false);
    }
  }

  async function confirmDeleteVariant() {
    if (!deleteVariantTarget) return;
    setDeletingId(deleteVariantTarget.id);
    setDeleteVariantTarget(null);
    try {
      await api.delete(`/api/products/${productId}/variants/${deleteVariantTarget.id}`);
      fetchProduct();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus variant");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Memuat...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="space-y-4">
        <Link href={backHref}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Button>
        </Link>
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error || "Produk tidak ditemukan"}
        </div>
      </div>
    );
  }

  const categoryName = product.Category?.name ?? product.category?.name ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={backHref}>
            <Button variant="ghost" size="sm" className="gap-1.5 px-2">
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">
            {product.name}
          </h1>
        </div>
        <Badge variant={product.is_active !== false ? "default" : "secondary"}>
          {product.is_active !== false ? "Aktif" : "Nonaktif"}
        </Badge>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">Kategori</p>
            <p className="font-medium text-slate-800">{categoryName ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Jumlah Variant</p>
            <p className="font-medium text-slate-800">{variants.length}</p>
          </div>
        </div>
        {product.description ? (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">Deskripsi</p>
            <p className="mt-1 text-sm text-slate-700">{product.description}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Variant</h2>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setVName("");
                setVSku("");
                setVPrice("");
                setVImageFile(null);
                setVError("");
                setVariantDialog(true);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Variant
            </Button>
          )}
        </div>

        {variants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
            Belum ada variant
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {variants.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3">
                <div className="w-14 shrink-0">
                  <VariantImage url={v.image_url} name={v.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {v.name}
                    </p>
                    {v.is_active === false && (
                      <Badge variant="secondary" className="text-xs">
                        Nonaktif
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs font-mono text-slate-400">
                    {v.sku}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatRp(v.price)}
                  </p>
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openEditVariant(v)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        disabled={deletingId === v.id}
                        onClick={() => setDeleteVariantTarget(v)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {deletingId === v.id ? "Menghapus..." : "Hapus"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Variant Dialog */}
      <Dialog open={variantDialog} onOpenChange={setVariantDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Variant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddVariant} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Variant</Label>
              <Input
                placeholder="cth. Large"
                value={vName}
                onChange={(e) => setVName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input
                placeholder="cth. PROD-LG"
                value={vSku}
                onChange={(e) => setVSku(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Harga</Label>
              <Input
                type="number"
                placeholder="0"
                value={vPrice}
                onChange={(e) => setVPrice(e.target.value)}
                required
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Foto (opsional)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setVImageFile(e.target.files?.[0] ?? null)}
              />
              {vImageFile && (
                <p className="text-xs text-slate-500">{vImageFile.name}</p>
              )}
            </div>
            {vError && <p className="text-sm text-red-600">{vError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={vLoading} className="w-full">
                {vLoading ? "Menyimpan..." : "Tambah Variant"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Variant Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditVariant} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nama Variant</Label>
              <Input
                placeholder="cth. Default Updated"
                value={evName}
                onChange={(e) => setEvName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Harga</Label>
              <Input
                type="number"
                placeholder="0"
                value={evPrice}
                onChange={(e) => setEvPrice(e.target.value)}
                required
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status Active</Label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={evIsActive}
                  onChange={(e) => setEvIsActive(e.target.checked)}
                />
                Aktif
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Ganti Foto (opsional)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setEvImageFile(e.target.files?.[0] ?? null)}
              />
              {evImageFile ? (
                <p className="text-xs text-slate-500">{evImageFile.name}</p>
              ) : (
                <p className="text-xs text-slate-400">
                  Kosongkan jika tidak ingin mengubah foto
                </p>
              )}
            </div>
            {evError && <p className="text-sm text-red-600">{evError}</p>}
            <DialogFooter>
              <Button type="submit" disabled={evLoading} className="w-full">
                {evLoading ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Variant Confirm */}
      <Dialog
        open={deleteVariantTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteVariantTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Variant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Hapus variant{" "}
            <strong>&ldquo;{deleteVariantTarget?.name}&rdquo;</strong>?
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteVariantTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDeleteVariant}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
