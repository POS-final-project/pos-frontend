"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, Pencil, X, Eye, EyeOff, Lock } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { getUser, type AuthUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";
import { setCookie } from "@/lib/cookies";

type ProfileData = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  shopId?: string | null;
  photo?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  user: "Kasir",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function syncUserCookie(updated: Partial<AuthUser>) {
  const current = getUser();
  if (!current) return;
  setCookie("pos_user", JSON.stringify({ ...current, ...updated }));
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-0 py-3 border-b border-slate-100 last:border-0">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide sm:w-40 shrink-0">
        {label}
      </span>
      <span className="text-sm text-slate-800 font-medium">
        {value || <span className="text-slate-400 font-normal italic">Belum diisi</span>}
      </span>
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "••••••••"}
          required={required}
          className="pr-10"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  // Photo upload
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  // Change password dialog
  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ success: boolean; data: ProfileData }>("/api/profile");
        const data = res.data as ProfileData;
        setProfile(data);
      } catch {
        const user = getUser();
        if (user) setProfile({ ...user, phone: null, photo: null });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function startEdit() {
    if (!profile) return;
    setDraftName(profile.name ?? "");
    setDraftEmail(profile.email ?? "");
    setDraftPhone(profile.phone ?? "");
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await api.patch("/api/profile", {
        name: draftName.trim(),
        email: draftEmail.trim(),
        phone: draftPhone.trim() || undefined,
      });
      const updated = {
        name: draftName.trim(),
        email: draftEmail.trim(),
        phone: draftPhone.trim() || null,
      };
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      syncUserCookie({ name: updated.name, email: updated.email });
      setIsEditing(false);
      toast({ title: "Profil berhasil diperbarui", variant: "success" });
    } catch (err) {
      toast({
        title: "Gagal memperbarui profil",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
    } finally {
      setSaveLoading(false);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    const form = new FormData();
    form.append("photo", file);
    setPhotoLoading(true);
    try {
      await api.patch("/api/profile/photo", form);
      toast({ title: "Foto profil diperbarui", variant: "success" });
    } catch (err) {
      setPhotoPreview(null);
      toast({
        title: "Gagal mengunggah foto",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
    } finally {
      setPhotoLoading(false);
      e.target.value = "";
    }
  }

  function closePwDialog() {
    setPwOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Password baru tidak cocok", variant: "error" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password baru minimal 8 karakter", variant: "error" });
      return;
    }
    setPwLoading(true);
    try {
      await api.post("/api/auth/change-password", { newPassword });
      closePwDialog();
      toast({ title: "Password berhasil diubah", variant: "success" });
    } catch (err) {
      toast({
        title: "Gagal mengubah password",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "error",
      });
    } finally {
      setPwLoading(false);
    }
  }

  const avatarSrc = photoPreview ?? profile?.photo ?? null;
  const displayName = profile?.name ?? "";
  const roleLabel = ROLE_LABEL[profile?.role ?? ""] ?? profile?.role ?? "";

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="h-7 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-200 animate-pulse shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-full bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader
        title="Profile"
        description="Kelola informasi akun dan keamanan Anda"
      />

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">
            {isEditing ? "Edit Profil" : "Informasi Profil"}
          </h2>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEdit} className="gap-2 h-8">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Avatar Row */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-white">{getInitials(displayName)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoLoading}
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 transition-colors disabled:opacity-40 shadow-sm"
                title="Ganti foto profil"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div>
              <p className="font-semibold text-slate-900 leading-tight">{displayName}</p>
              <p className="text-sm text-slate-500">{profile?.email}</p>
              <Badge variant="secondary" className="mt-1.5 text-xs">{roleLabel}</Badge>
            </div>
          </div>

          {/* View mode: static rows */}
          {!isEditing && (
            <div className="rounded-lg border border-slate-100 px-4">
              <InfoRow label="Nama Lengkap" value={profile?.name ?? ""} />
              <InfoRow label="Email" value={profile?.email ?? ""} />
              <InfoRow label="Nomor Telepon" value={profile?.phone ?? ""} />
              <InfoRow label="Role" value={roleLabel} />
            </div>
          )}

          {/* Edit mode: form */}
          {isEditing && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Nama Lengkap</Label>
                  <Input
                    id="p-name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-phone">Nomor Telepon</Label>
                  <Input
                    id="p-phone"
                    value={draftPhone}
                    onChange={(e) => setDraftPhone(e.target.value)}
                    placeholder="cth. 08123456789"
                    type="tel"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input
                  id="p-email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  required
                  type="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Input
                  value={roleLabel}
                  readOnly
                  className="bg-slate-50 text-slate-400 cursor-default"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={saveLoading}
                  className="gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Batal
                </Button>
                <Button type="submit" disabled={saveLoading}>
                  {saveLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Security Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Keamanan Akun</h2>
        </div>
        <div className="px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">Password</p>
              <p className="text-xs text-slate-400 mt-0.5">Gunakan password yang kuat dan unik</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPwOpen(true)} className="shrink-0">
            Ubah Password
          </Button>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={pwOpen} onOpenChange={(open) => { if (!open) closePwDialog(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-3 mt-1">
            <PasswordInput
              id="pw-new"
              label="Password Baru"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Min. 8 karakter"
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
              required
            />
            <PasswordInput
              id="pw-confirm"
              label="Konfirmasi Password Baru"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Ulangi password baru"
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
              required
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500">Password baru tidak cocok</p>
            )}
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closePwDialog}
                disabled={pwLoading}
              >
                Batal
              </Button>
              <Button type="submit" disabled={pwLoading}>
                {pwLoading ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
