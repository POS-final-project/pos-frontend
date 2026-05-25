"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Store, Users, Search, UserPlus, UserMinus } from "lucide-react";
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
import { getUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

type Shop = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
};

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AllUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  shop_id?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "Kasir",
};

interface TokoPageProps {
  role: "superadmin" | "admin";
}

export function TokoPage({ role }: TokoPageProps) {
  const { toast } = useToast();
  const user = getUser();
  const [staffTab, setStaffTab] = useState<"list" | "assign">("list");

  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create / Edit dialog
  const [shopDialog, setShopDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Shop | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Staff dialog
  const [staffDialog, setStaffDialog] = useState(false);
  const [staffShop, setStaffShop] = useState<Shop | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);

  // Assign staff
  const [removeTarget, setRemoveTarget] = useState<Staff | null>(null);

  const [allUsers, setAllUsers] = useState<AllUser[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [allUsersError, setAllUsersError] = useState("");
  const [assignSearch, setAssignSearch] = useState("");
  const [assignLoading, setAssignLoading] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (role === "admin" && user?.shopId) {
        const res = await api.get<{ success: boolean; data: unknown }>(`/api/shops/${user.shopId}`);
        const shop = res.data as Shop;
        setShops(shop?.id ? [shop] : []);
      } else {
        const res = await api.get<{ success: boolean; data: unknown }>("/api/shops?page=1&limit=100");
        setShops(extractList<Shop>(res.data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat toko");
    } finally {
      setLoading(false);
    }
  }, [role, user?.shopId]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  function openCreate() {
    setEditTarget(null);
    setFormName("");
    setFormAddress("");
    setFormPhone("");
    setFormError("");
    setShopDialog(true);
  }

  function openEdit(shop: Shop) {
    setEditTarget(shop);
    setFormName(shop.name);
    setFormAddress(shop.address ?? "");
    setFormPhone(shop.phone ?? "");
    setFormError("");
    setShopDialog(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const body = {
        name: formName,
        address: formAddress || undefined,
        phone: formPhone || undefined,
      };
      if (editTarget) {
        await api.patch(`/api/shops/${editTarget.id}`, body);
      } else {
        await api.post("/api/shops", body);
      }
      toast({
        title: editTarget ? "Toko diperbarui" : "Toko ditambahkan",
        variant: "success",
      });
      setShopDialog(false);
      fetchShops();
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
      await api.delete(`/api/shops/${deleteTarget.id}`);
      toast({ title: "Toko dihapus", variant: "success" });
      setDeleteDialog(false);
      fetchShops();
    } catch (err) {
      toast({
        title: "Gagal menghapus toko",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
      setDeleteDialog(false);
    } finally {
      setDeleteLoading(false);
    }
  }

  async function openStaff(shop: Shop) {
    setStaffShop(shop);
    setStaffList([]);
    setAssignSearch("");
    setAllUsersError("");
    setStaffDialog(true);
    setStaffLoading(true);
    setAllUsersLoading(true);

    const [staffRes] = await Promise.allSettled([
      api.get<{ success: boolean; data: unknown }>(`/api/shops/${shop.id}/staff`),
      api.get<{ success: boolean; data: unknown }>("/api/users?page=1&limit=200"),
    ]).then(([sr, ur]) => {
      if (sr.status === "fulfilled") {
        setStaffList(extractList<Staff>(sr.value.data));
      }
      setStaffLoading(false);

      if (ur.status === "fulfilled") {
        setAllUsers(extractList<AllUser>((ur as PromiseFulfilledResult<{ data: unknown }>).value.data));
      } else {
        setAllUsersError("Daftar pengguna tidak tersedia");
        setAllUsers([]);
      }
      setAllUsersLoading(false);
      return [sr];
    });
    void staffRes;
  }

  async function handleRemoveStaff() {
    if (!staffShop || !removeTarget) return;
    setRemoveLoading(removeTarget.id);
    const target = removeTarget;
    setRemoveTarget(null);
    try {
      await api.delete(`/api/shops/${staffShop.id}/staff/${target.id}`);
      setStaffList((prev) => prev.filter((s) => s.id !== target.id));
      toast({ title: `${target.name} dilepas dari toko`, variant: "success" });
    } catch (err) {
      toast({
        title: "Gagal melepas staff",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
    } finally {
      setRemoveLoading(null);
    }
  }

  async function handleAssignStaff(userId: string) {
    if (!staffShop) return;
    setAssignLoading(userId);
    try {
      await api.post(`/api/shops/${staffShop.id}/staff`, { userId });
      const res = await api.get<{ success: boolean; data: unknown }>(`/api/shops/${staffShop.id}/staff`);
      setStaffList(extractList<Staff>(res.data));
      toast({ title: "Staff berhasil ditambahkan ke toko", variant: "success" });
    } catch (err) {
      toast({
        title: "Gagal menambahkan staff",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
    } finally {
      setAssignLoading(null);
    }
  }

  const assignedIds = new Set(staffList.map((s) => s.id));

  const filteredAssignUsers = allUsers.filter(
    (u) =>
      u.role !== "superadmin" &&
      !assignedIds.has(u.id) &&
      (!assignSearch ||
        u.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(assignSearch.toLowerCase()))
  );

  const canCreate = role === "superadmin";
  const canDelete = role === "superadmin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Toko"
        description={canCreate ? "Kelola semua cabang toko" : "Informasi toko Anda"}
        count={loading ? undefined : shops.length}
        action={
          canCreate ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Toko
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>
              <TableSkeleton cols={5} rows={4} />
            </tbody>
          </table>
        ) : shops.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Belum ada toko"
            description={canCreate ? "Tambahkan toko untuk mulai mengelola cabang" : "Toko belum dikonfigurasi"}
            action={
              canCreate ? (
                <Button onClick={openCreate} variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Tambah Toko
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-3">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-16 text-center">#</TableHead>
                <TableHead>Nama Toko</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead className="w-36 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((shop, i) => (
                <TableRow key={shop.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="text-center tabular-nums text-slate-400">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{shop.name}</TableCell>
                  <TableCell
                    className="text-slate-500 max-w-48 truncate"
                    title={shop.address ?? undefined}
                  >
                    {shop.address ?? "-"}
                  </TableCell>
                  <TableCell className="text-slate-500" title={shop.phone ?? undefined}>
                    {shop.phone ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openStaff(shop)}
                        title="Kelola Staff"
                        className="text-slate-500 hover:text-amber-600"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(shop)}
                        className="text-slate-500 hover:text-amber-600"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setDeleteTarget(shop); setDeleteDialog(true); }}
                          className="text-slate-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={shopDialog} onOpenChange={setShopDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Toko" : "Tambah Toko"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Nama Toko</Label>
              <Input
                id="s-name"
                placeholder="cth. Toko Cabang A"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-addr">Alamat</Label>
              <Input
                id="s-addr"
                placeholder="cth. Jl. Merdeka No. 1"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Nomor Telepon</Label>
              <Input
                id="s-phone"
                placeholder="cth. 02112345678"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShopDialog(false)} disabled={formLoading}>
                Batal
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Menyimpan..." : editTarget ? "Simpan Perubahan" : "Tambah Toko"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Toko</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Hapus toko <strong>{deleteTarget?.name}</strong>? Seluruh data terkait toko ini akan ikut dihapus.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)} disabled={deleteLoading}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Management Dialog */}
      <Dialog open={staffDialog} onOpenChange={(open) => { setStaffDialog(open); if (!open) setStaffTab("list"); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Staff — {staffShop?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setStaffTab("list")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-md transition-colors",
                staffTab === "list"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Staff Terdaftar
              {!staffLoading && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  staffTab === "list" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"
                )}>
                  {staffList.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStaffTab("assign")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-md transition-colors",
                staffTab === "assign"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Tambah Staff
            </button>
          </div>

          {staffTab === "list" ? (
            /* ── Tab 1: Assigned staff ── */
            staffLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Memuat...</div>
            ) : staffList.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">Belum ada staff</p>
                <p className="text-xs text-slate-400">Klik tab &quot;Tambah Staff&quot; untuk menugaskan pengguna ke toko ini</p>
                <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={() => setStaffTab("assign")}>
                  <UserPlus className="w-3.5 h-3.5" />
                  Tambah Staff
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between px-3 py-2.5 gap-3 bg-white hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{staff.name}</p>
                      <p className="text-xs text-slate-400 truncate">{staff.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {ROLE_LABEL[staff.role] ?? staff.role}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRemoveTarget(staff)}
                        disabled={removeLoading === staff.id}
                        title="Lepas dari toko"
                        className="text-slate-400 hover:text-red-500 disabled:opacity-50"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* ── Tab 2: Assign new staff ── */
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Cari nama atau email pengguna..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                  autoFocus
                />
              </div>

              {allUsersLoading ? (
                <div className="py-8 text-center text-sm text-slate-400">Memuat pengguna...</div>
              ) : allUsersError ? (
                <div className="py-6 text-center text-sm text-red-500 bg-red-50 rounded-lg">
                  {allUsersError}
                </div>
              ) : filteredAssignUsers.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400 bg-slate-50 rounded-lg">
                  {assignSearch
                    ? `Tidak ada pengguna yang cocok dengan "${assignSearch}"`
                    : "Semua pengguna sudah ditugaskan ke toko ini"}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {filteredAssignUsers.map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 gap-3 bg-white hover:bg-slate-50/70 transition-colors",
                        assignLoading === u.id && "opacity-60"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs capitalize">
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignStaff(u.id)}
                          disabled={assignLoading === u.id}
                          className="h-7 text-xs gap-1.5 hover:border-amber-400 hover:text-amber-600"
                        >
                          <UserPlus className="w-3 h-3" />
                          {assignLoading === u.id ? "..." : "Tugaskan"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unassign Staff Confirm */}
      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lepas Staff</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Lepas <strong>{removeTarget?.name}</strong> dari toko{" "}
            <strong>{staffShop?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleRemoveStaff}>
              Ya, Lepas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
