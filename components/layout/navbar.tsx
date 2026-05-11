"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, LogOut, Menu, User } from "lucide-react";
import Link from "next/link";
import { getUser, clearAuth, type AuthUser } from "@/lib/auth";

type RoleConfig = {
  name: string;
  email: string;
  roleLabel: string;
  profileHref: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
};

function buildConfig(user: AuthUser | null, roleKey: string): RoleConfig {
  const defaults: Record<string, RoleConfig> = {
    superadmin: { name: "Super Admin", email: "superadmin@pos.com", roleLabel: "Super Admin", profileHref: "/superadmin/profile", badgeVariant: "default" },
    admin: { name: "Admin Toko", email: "admin@pos.com", roleLabel: "Admin", profileHref: "/admin/profile", badgeVariant: "secondary" },
    user: { name: "Kasir", email: "kasir@pos.com", roleLabel: "Kasir", profileHref: "/user/profile", badgeVariant: "outline" },
  };
  const def = defaults[roleKey] ?? defaults.user;
  if (!user) return def;
  return {
    name: user.name,
    email: user.email,
    roleLabel: def.roleLabel,
    profileHref: def.profileHref,
    badgeVariant: def.badgeVariant,
  };
}

const PAGE_TITLES: Record<string, string> = {
  superadmin: "Dashboard",
  admin: "Dashboard",
  user: "Kasir",
  transaksi: "Transaksi",
  produk: "Produk",
  kategori: "Kategori",
  inventory: "Inventory",
  "transfer-stok": "Transfer Stok",
  kasir: "Kasir",
  refund: "Refund",
  toko: "Toko",
  pelanggan: "Pelanggan",
  ai: "AI Assistant",
  notifikasi: "Notifikasi",
  "log-audit": "Log & Audit",
  laporan: "Laporan",
  profile: "Profile",
};

function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return PAGE_TITLES[last] ?? "Dashboard";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setAuthUser(getUser());
  }, []);

  const roleKey = pathname.startsWith("/superadmin")
    ? "superadmin"
    : pathname.startsWith("/admin")
      ? "admin"
      : "user";

  const config = buildConfig(authUser, roleKey);
  const pageTitle = getPageTitle(pathname);

  const notifHref =
    roleKey === "superadmin"
      ? "/superadmin/notifikasi"
      : roleKey === "admin"
        ? "/admin/notifikasi"
        : null;

  return (
    <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      {/* Left - Hamburger (mobile) + Page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Buka menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800">{pageTitle}</h2>
      </div>

      {/* Right - Notification + Profile dropdown */}
      <div className="flex items-center gap-1">
        {notifHref && (
          <Link
            href={notifHref}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Notifikasi"
          >
            <Bell className="w-5 h-5" />
          </Link>
        )}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-slate-100 transition-colors outline-none cursor-pointer">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-indigo-600 text-white text-xs font-semibold">
              {getInitials(config.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">
            {config.name}
          </span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <div className="flex items-center gap-3 px-2 py-2.5">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-indigo-600 text-white text-sm font-semibold">
                {getInitials(config.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-semibold text-slate-900 text-sm truncate">
                {config.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {config.email}
              </span>
              <Badge
                variant={config.badgeVariant}
                className="w-fit text-xs mt-0.5"
              >
                {config.roleLabel}
              </Badge>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => router.push(config.profileHref)}>
            <User className="mr-2 h-4 w-4" />
            Lihat Profil
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => { clearAuth(); router.push("/login"); }}
            variant="destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
