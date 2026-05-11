"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { api } from "@/lib/api";

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

type Category = {
  id: string;
  name: string;
  createdAt?: string;
};

type ApiItemResponse = {
  success: boolean;
  data: Category;
};

interface KategoriPageProps {
  canEdit?: boolean;
}

export function KategoriPage({ canEdit = true }: KategoriPageProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ success: boolean; data: unknown }>(
        "/api/categories?page=1&limit=100",
      );
      setCategories(extractList<Category>(res.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat kategori");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function openCreate() {
    setEditTarget(null);
    setFormName("");
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditTarget(cat);
    setFormName(cat.name);
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Nama kategori tidak boleh kosong");
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      if (editTarget) {
        await api.patch<ApiItemResponse>(`/api/categories/${editTarget.id}`, {
          name: formName.trim(),
        });
        toast({ title: "Kategori diperbarui", variant: "success" });
      } else {
        await api.post<ApiItemResponse>("/api/categories", { name: formName.trim() });
        toast({ title: "Kategori ditambahkan", variant: "success" });
      }
      setDialogOpen(false);
      fetchCategories();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setFormLoading(false);
    }
  }

  function openDelete(cat: Category) {
    setDeleteTarget(cat);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/categories/${deleteTarget.id}`);
      toast({ title: "Kategori dihapus", variant: "success" });
      setDeleteOpen(false);
      fetchCategories();
    } catch (err) {
      toast({
        title: "Gagal menghapus",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
      setDeleteOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Kategori</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {canEdit
              ? "Kelola kategori produk"
              : "Daftar kategori produk (read-only)"}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah Kategori
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
              <TableSkeleton cols={canEdit ? 3 : 2} rows={5} />
            </tbody>
          </table>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="Belum ada kategori"
            description="Buat kategori untuk mengelompokkan produk Anda"
            action={
              canEdit ? (
                <Button onClick={openCreate} variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Tambah Kategori
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-3">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead>Nama Kategori</TableHead>
                {canEdit && (
                  <TableHead className="w-32 text-right">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat, i) => (
                <TableRow key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="text-center tabular-nums text-slate-400">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(cat)}
                          className="text-slate-500 hover:text-indigo-600"
                          title="Edit kategori"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openDelete(cat)}
                          className="text-slate-500 hover:text-red-600"
                          title="Hapus kategori"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Kategori" : "Tambah Kategori"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">
                Nama Kategori <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cat-name"
                placeholder="cth. Minuman"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormError(""); }}
                autoFocus
              />
              <p className="text-xs text-slate-400">
                Digunakan untuk mengelompokkan produk dalam katalog
              </p>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={formLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading
                  ? "Menyimpan..."
                  : editTarget
                    ? "Simpan Perubahan"
                    : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Kategori</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Hapus kategori <strong>{deleteTarget?.name}</strong>? Produk yang
            menggunakan kategori ini tidak akan ikut terhapus, tetapi tidak
            memiliki kategori.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
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
