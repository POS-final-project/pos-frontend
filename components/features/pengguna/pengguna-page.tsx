"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Pencil, UserCog, Plus, Eye, EyeOff } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
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
import { PageHeader } from "@/components/layout/page-header";

type Shop = { id: string; name: string };

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  shopId?: string | null;
};

type PaginatedResponse = {
  rows?: UserItem[];
  count?: number;
  totalPages?: number;
};

function extractUsers(data: unknown): { items: UserItem[]; totalPages: number } {
  if (Array.isArray(data)) return { items: data as UserItem[], totalPages: 1 };
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.data)) {
      const meta = d.meta as Record<string, unknown> | undefined;
      const totalPages = typeof meta?.totalPages === "number" ? meta.totalPages : 1;
      return { items: d.data as UserItem[], totalPages };
    }
    if (Array.isArray(d.rows)) {
      const p = d as unknown as PaginatedResponse;
      return { items: p.rows ?? [], totalPages: p.totalPages ?? 1 };
    }
  }
  return { items: [], totalPages: 1 };
}

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "Kasir",
};

const ROLE_COLOR: Record<string, string> = {
  superadmin: "bg-purple-100 text-purple-700 border-purple-200",
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  user: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function UserAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="relative w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
      <span className="text-xs font-semibold text-amber-700">{initials}</span>
      {imageUrl && (
        <img
          src={`/backend${imageUrl}`}
          alt={name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
      )}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const LIMIT = 20;

export function PenggunaPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Register dialog
  const [regDialog, setRegDialog] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regShowPwd, setRegShowPwd] = useState(false);
  const [regRole, setRegRole] = useState<"admin" | "user">("user");
  const [regShopId, setRegShopId] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [shops, setShops] = useState<Shop[]>([]);

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formShopId, setFormShopId] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter !== "") params.set("is_active", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));

      const res = await api.get<{ success: boolean; data: unknown; meta?: Record<string, unknown> }>(
        `/api/users?${params.toString()}`
      );
      const { items, totalPages: tp } = extractUsers(res);
      setUsers(items);
      setTotalPages(tp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengguna");
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    api
      .get<{ data: unknown }>("/api/shops?page=1&limit=100")
      .then((res) => {
        const data = res.data;
        if (Array.isArray(data)) setShops(data as Shop[]);
        else if (data && typeof data === "object") {
          const d = data as Record<string, unknown>;
          if (Array.isArray(d.data)) setShops(d.data as Shop[]);
          else if (Array.isArray(d.rows)) setShops(d.rows as Shop[]);
        }
      })
      .catch(() => setShops([]));
  }, []);

  function openRegister() {
    setRegName("");
    setRegEmail("");
    setRegPassword("");
    setRegShowPwd(false);
    setRegRole("user");
    setRegShopId("");
    setRegError("");
    setRegDialog(true);
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRegLoading(true);
    setRegError("");
    try {
      const endpoint =
        regRole === "admin"
          ? "/api/auth/register/admin"
          : "/api/auth/register/user";
      await api.post(endpoint, {
        name: regName,
        email: regEmail,
        password: regPassword,
        shopId: regShopId || undefined,
      });
      toast({ title: "Pengguna berhasil didaftarkan", variant: "success" });
      setRegDialog(false);
      fetchUsers();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Gagal mendaftarkan pengguna");
    } finally {
      setRegLoading(false);
    }
  }

  function applySearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleRoleFilter(v: string) {
    setRoleFilter(v);
    setPage(1);
  }

  function handleStatusFilter(v: string) {
    setStatusFilter(v);
    setPage(1);
  }

  function openEdit(u: UserItem) {
    setEditTarget(u);
    setFormName(u.name);
    setFormPhone(u.phone ?? "");
    setFormRole(u.role);
    setFormActive(u.is_active);
    setFormShopId(u.shopId ?? "");
    setFormError("");
    setEditDialog(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setFormLoading(true);
    setFormError("");
    try {
      await api.patch(`/api/users/${editTarget.id}`, {
        name: formName,
        phone: formPhone || undefined,
        role: formRole,
        is_active: formActive,
        shopId: formShopId || null,
      });
      toast({ title: "Data pengguna diperbarui", variant: "success" });
      setEditDialog(false);
      fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengguna"
        description="Kelola akun pengguna, role, dan status aktif"
        count={loading ? undefined : users.length}
        action={
          <Button onClick={openRegister} className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah Pengguna
          </Button>
        }
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="flex gap-1.5 flex-1 min-w-48">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Cari nama atau email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={applySearch} className="h-9">
            Cari
          </Button>
        </div>

        {/* Role filter */}
        <Select value={roleFilter} onValueChange={(v) => handleRoleFilter(v ?? "")}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <span className="truncate text-sm">
              {roleFilter ? (ROLE_LABEL[roleFilter] ?? roleFilter) : "Semua Role"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua Role</SelectItem>
            <SelectItem value="superadmin">Super Admin</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">Kasir</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={(v) => handleStatusFilter(v ?? "")}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <span className="truncate text-sm">
              {statusFilter === "true" ? "Aktif" : statusFilter === "false" ? "Nonaktif" : "Semua Status"}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Semua Status</SelectItem>
            <SelectItem value="true">Aktif</SelectItem>
            <SelectItem value="false">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>
              <TableSkeleton cols={7} rows={5} />
            </tbody>
          </table>
        ) : users.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="Tidak ada pengguna ditemukan"
            description={
              search || roleFilter || statusFilter
                ? "Coba ubah filter pencarian"
                : "Tambahkan pengguna baru untuk mulai mengelola akses"
            }
          />
        ) : (
          <Table className="[&_th]:px-4 [&_td]:px-4 [&_th]:h-11 [&_td]:py-2.5">
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead className="w-28">Role</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32">Bergabung</TableHead>
                <TableHead className="w-16 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u, i) => (
                <TableRow key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <TableCell className="text-center tabular-nums text-slate-400">
                    {(page - 1) * LIMIT + i + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={u.name} imageUrl={u.image_url} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                        <p className="text-xs text-slate-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                        ROLE_COLOR[u.role] ?? "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {u.phone ?? <span className="italic text-slate-300">-</span>}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                        u.is_active
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          u.is_active ? "bg-green-500" : "bg-slate-400"
                        )}
                      />
                      {u.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(u)}
                      className="text-slate-400 hover:text-amber-600"
                      title="Edit pengguna"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={LIMIT}
      />

      {/* Register Dialog */}
      <Dialog open={regDialog} onOpenChange={setRegDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* Role toggle — choose first so shopId requirement is clear */}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRegRole("user")}
                  className={cn(
                    "flex-1 py-2 text-sm rounded-lg border transition-colors",
                    regRole === "user"
                      ? "bg-emerald-50 border-emerald-400 text-emerald-700 font-medium"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  Kasir
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole("admin")}
                  className={cn(
                    "flex-1 py-2 text-sm rounded-lg border transition-colors",
                    regRole === "admin"
                      ? "bg-blue-50 border-blue-400 text-blue-700 font-medium"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  Admin
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-name">Nama Lengkap</Label>
              <Input
                id="r-name"
                placeholder="Nama lengkap pengguna"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-email">Email</Label>
              <Input
                id="r-email"
                type="email"
                placeholder="Alamat email untuk masuk"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-pwd">Password</Label>
              <div className="relative">
                <Input
                  id="r-pwd"
                  type={regShowPwd ? "text" : "password"}
                  placeholder="Buat password minimal 8 karakter"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setRegShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {regShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Toko
                <span className="ml-1 text-slate-400 font-normal text-xs">(opsional)</span>
              </Label>
              <Select value={regShopId} onValueChange={(v) => setRegShopId(v ?? "")}>
                <SelectTrigger>
                  <span className="truncate text-sm">
                    {regShopId
                      ? (shops.find((s) => s.id === regShopId)?.name ?? "Pilih toko...")
                      : "Tanpa toko"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tanpa toko</SelectItem>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {regError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {regError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegDialog(false)}
                disabled={regLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={regLoading}>
                {regLoading ? "Mendaftarkan..." : "Daftarkan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-sm overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
          </DialogHeader>

          {editTarget && (
            <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
              <UserAvatar name={editTarget.name} imageUrl={editTarget.image_url} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{editTarget.name}</p>
                <p className="text-xs text-slate-400">{editTarget.email}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nama</Label>
              <Input
                id="u-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-phone">Nomor Telepon</Label>
              <Input
                id="u-phone"
                placeholder="Nomor telepon pengguna"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v ?? "")}>
                <SelectTrigger>
                  <span className="text-sm">{ROLE_LABEL[formRole] ?? formRole}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">Kasir</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status Akun</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormActive(true)}
                  className={cn(
                    "flex-1 py-2 text-sm rounded-lg border transition-colors",
                    formActive
                      ? "bg-green-50 border-green-400 text-green-700 font-medium"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  onClick={() => setFormActive(false)}
                  className={cn(
                    "flex-1 py-2 text-sm rounded-lg border transition-colors",
                    !formActive
                      ? "bg-red-50 border-red-400 text-red-700 font-medium"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  )}
                >
                  Nonaktif
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>
                Toko
                <span className="ml-1 text-slate-400 font-normal text-xs">(opsional)</span>
              </Label>
              <Select value={formShopId} onValueChange={(v) => setFormShopId(v ?? "")}>
                <SelectTrigger>
                  <span className="truncate text-sm">
                    {formShopId
                      ? (shops.find((s) => s.id === formShopId)?.name ?? "Pilih toko...")
                      : "Tanpa toko"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tanpa toko</SelectItem>
                  {shops.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialog(false)}
                disabled={formLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
