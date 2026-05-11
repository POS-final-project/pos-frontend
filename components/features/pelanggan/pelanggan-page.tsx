"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Users, Search, UserPlus } from "lucide-react";
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

type Customer = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
};

export function PelangganPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Create / Edit dialog
  const [dialog, setDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<{ success: boolean; data: unknown }>("/api/customers?page=1&limit=200");
      setCustomers(extractList<Customer>(res.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pelanggan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditTarget(null);
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormError("");
    setDialog(true);
  }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setFormName(c.name);
    setFormPhone(c.phone ?? "");
    setFormEmail(c.email ?? "");
    setFormAddress(c.address ?? "");
    setFormError("");
    setDialog(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Nama pelanggan tidak boleh kosong");
      return;
    }
    setFormError("");
    setFormLoading(true);
    try {
      const body = {
        name: formName.trim(),
        phone: formPhone || undefined,
        email: formEmail || undefined,
        address: formAddress || undefined,
      };
      if (editTarget) {
        await api.patch(`/api/customers/${editTarget.id}`, body);
        toast({ title: "Data pelanggan diperbarui", variant: "success" });
      } else {
        await api.post("/api/customers", body);
        toast({ title: "Pelanggan ditambahkan", variant: "success" });
      }
      setDialog(false);
      fetchCustomers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/customers/${deleteTarget.id}`);
      toast({ title: "Pelanggan dihapus", variant: "success" });
      setDeleteDialog(false);
      fetchCustomers();
    } catch (err) {
      toast({
        title: "Gagal menghapus",
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
          <h1 className="text-xl font-semibold text-slate-900">Pelanggan</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola data pelanggan</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Tambah Pelanggan
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari nama, telepon, atau email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {search && (
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {filtered.length} hasil
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>
              <TableSkeleton cols={6} rows={5} />
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "Pelanggan tidak ditemukan" : "Belum ada pelanggan"}
            description={
              search
                ? `Tidak ada pelanggan yang cocok dengan "${search}"`
                : "Tambahkan pelanggan untuk mempermudah proses transaksi"
            }
            action={
              !search ? (
                <Button onClick={openCreate} variant="outline" size="sm" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Tambah Pelanggan
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-3">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead className="w-32 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c, i) => (
                <TableRow key={c.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="text-center tabular-nums text-slate-400">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-slate-500">{c.phone ?? "-"}</TableCell>
                  <TableCell className="text-slate-500">{c.email ?? "-"}</TableCell>
                  <TableCell
                    className="text-slate-500 max-w-40 truncate"
                    title={c.address ?? undefined}
                  >
                    {c.address ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(c)}
                        className="text-slate-500 hover:text-indigo-600"
                        title="Edit pelanggan"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => { setDeleteTarget(c); setDeleteDialog(true); }}
                        className="text-slate-500 hover:text-red-600"
                        title="Hapus pelanggan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Pelanggan" : "Tambah Pelanggan"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">
                Nama <span className="text-red-500">*</span>
              </Label>
              <Input
                id="c-name"
                placeholder="cth. Budi Santoso"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setFormError(""); }}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">
                  Telepon <span className="text-xs text-slate-400 font-normal">(opsional)</span>
                </Label>
                <Input
                  id="c-phone"
                  placeholder="08123456789"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">
                  Email <span className="text-xs text-slate-400 font-normal">(opsional)</span>
                </Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="email@contoh.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-addr">
                Alamat <span className="text-xs text-slate-400 font-normal">(opsional)</span>
              </Label>
              <Input
                id="c-addr"
                placeholder="cth. Jl. Sudirman No. 10"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(false)}
                disabled={formLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading
                  ? "Menyimpan..."
                  : editTarget
                  ? "Simpan Perubahan"
                  : "Tambah Pelanggan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Pelanggan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Hapus pelanggan <strong>{deleteTarget?.name}</strong>? Riwayat
            transaksi terkait pelanggan ini tidak akan ikut terhapus.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog(false)}
              disabled={deleteLoading}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
