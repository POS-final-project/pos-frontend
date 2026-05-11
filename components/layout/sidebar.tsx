"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getUser, type AuthUser } from "@/lib/auth";
import {
  LayoutDashboard,
  Receipt,
  Package,
  Tag,
  Warehouse,
  ArrowLeftRight,
  ShoppingCart,
  RotateCcw,
  Store,
  Users,
  UserCog,
  Bot,
  Bell,
  FileText,
  BarChart3,
  User,
  X,
  ChevronRight,
  Layers,
  ShoppingBag,
  TrendingUp,
  Settings,
  Archive,
} from "lucide-react";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type StandaloneItem = { type: "item" } & NavItem;

type NavGroup = {
  type: "group";
  label: string;
  groupIcon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

type NavEntry = StandaloneItem | NavGroup;

const SUPERADMIN_NAV: NavEntry[] = [
  {
    type: "item",
    title: "Dashboard",
    href: "/superadmin",
    icon: LayoutDashboard,
  },
  {
    type: "group",
    label: "Manajemen",
    groupIcon: Layers,
    items: [
      { title: "Produk", href: "/superadmin/produk", icon: Package },
      { title: "Kategori", href: "/superadmin/kategori", icon: Tag },
      { title: "Toko", href: "/superadmin/toko", icon: Store },
      { title: "Pengguna", href: "/superadmin/pengguna", icon: UserCog },
      { title: "Pelanggan", href: "/superadmin/pelanggan", icon: Users },
    ],
  },
  {
    type: "group",
    label: "Inventori",
    groupIcon: Archive,
    items: [
      { title: "Inventory", href: "/superadmin/inventory", icon: Warehouse },
      {
        title: "Transfer Stok",
        href: "/superadmin/transfer-stok",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    type: "group",
    label: "Transaksi & Kasir",
    groupIcon: ShoppingBag,
    items: [
      { title: "Kasir", href: "/superadmin/kasir", icon: ShoppingCart },
      { title: "Transaksi", href: "/superadmin/transaksi", icon: Receipt },
      { title: "Refund", href: "/superadmin/refund", icon: RotateCcw },
    ],
  },
  {
    type: "group",
    label: "Analitik",
    groupIcon: TrendingUp,
    items: [
      { title: "Laporan", href: "/superadmin/laporan", icon: BarChart3 },
      { title: "AI Assistant", href: "/superadmin/ai", icon: Bot },
    ],
  },
  {
    type: "group",
    label: "Sistem",
    groupIcon: Settings,
    items: [
      { title: "Notifikasi", href: "/superadmin/notifikasi", icon: Bell },
      { title: "Log & Audit", href: "/superadmin/log-audit", icon: FileText },
    ],
  },
  { type: "item", title: "Profile", href: "/superadmin/profile", icon: User },
];

const ADMIN_NAV: NavEntry[] = [
  { type: "item", title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    type: "group",
    label: "Manajemen",
    groupIcon: Layers,
    items: [
      { title: "Produk", href: "/admin/produk", icon: Package },
      { title: "Kategori", href: "/admin/kategori", icon: Tag },
      { title: "Toko", href: "/admin/toko", icon: Store },
      { title: "Pelanggan", href: "/admin/pelanggan", icon: Users },
    ],
  },
  {
    type: "group",
    label: "Inventori",
    groupIcon: Archive,
    items: [
      { title: "Inventory", href: "/admin/inventory", icon: Warehouse },
      {
        title: "Transfer Stok",
        href: "/admin/transfer-stok",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    type: "group",
    label: "Transaksi & Kasir",
    groupIcon: ShoppingBag,
    items: [
      { title: "Kasir", href: "/admin/kasir", icon: ShoppingCart },
      { title: "Transaksi", href: "/admin/transaksi", icon: Receipt },
      { title: "Refund", href: "/admin/refund", icon: RotateCcw },
    ],
  },
  {
    type: "group",
    label: "Analitik",
    groupIcon: TrendingUp,
    items: [
      { title: "Laporan", href: "/admin/laporan", icon: BarChart3 },
      { title: "AI Assistant", href: "/admin/ai", icon: Bot },
    ],
  },
  {
    type: "group",
    label: "Sistem",
    groupIcon: Settings,
    items: [{ title: "Notifikasi", href: "/admin/notifikasi", icon: Bell }],
  },
  { type: "item", title: "Profile", href: "/admin/profile", icon: User },
];

// User/Kasir: cukup sedikit item, tidak perlu dikelompokkan
const USER_NAV: NavEntry[] = [
  { type: "item", title: "Kasir", href: "/user", icon: ShoppingCart },
  { type: "item", title: "Transaksi", href: "/user/transaksi", icon: Receipt },
  { type: "item", title: "Refund", href: "/user/refund", icon: RotateCcw },
  { type: "item", title: "Produk", href: "/user/produk", icon: Package },
  {
    type: "item",
    title: "Inventory",
    href: "/user/inventory",
    icon: Warehouse,
  },
  { type: "item", title: "Profile", href: "/user/profile", icon: User },
];

function isStandaloneActive(href: string, pathname: string): boolean {
  const isRoot = href.split("/").filter(Boolean).length === 1;
  if (isRoot) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

// ─── NavGroupSection ────────────────────────────────────────────────────────

function NavGroupSection({
  group,
  isOpen,
  onToggle,
  pathname,
  onLinkClick,
}: {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  onLinkClick: () => void;
}) {
  const GroupIcon = group.groupIcon;
  const hasActive = group.items.some((item) =>
    isGroupItemActive(item.href, pathname),
  );

  return (
    <li>
      {/* Group header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
          isOpen
            ? "text-slate-300 hover:bg-slate-800"
            : hasActive
              ? "text-indigo-400 hover:bg-slate-800"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
        )}
      >
        <GroupIcon className="w-4 h-4 shrink-0" />
        <span className="flex-1">{group.label}</span>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
            isOpen && "rotate-90",
          )}
        />
      </button>

      {/* Collapsible items — grid-rows animasi tanpa perlu JS height calculation */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <ul className="ml-3.5 pl-3 border-l border-slate-700/50 mt-1 mb-1 space-y-0.5">
            {group.items.map((item) => {
              const active = isGroupItemActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onLinkClick}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-indigo-500/20 text-indigo-300 shadow-sm ring-1 ring-indigo-500/30"
                        : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </li>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_OPEN: Record<string, boolean> = {
  Manajemen: true,
  Inventori: false,
  "Transaksi & Kasir": false,
  Analitik: false,
  Sistem: false,
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(DEFAULT_OPEN);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setAuthUser(getUser());
  }, []);

  const role = pathname.startsWith("/superadmin")
    ? "superadmin"
    : pathname.startsWith("/admin")
      ? "admin"
      : "user";

  const navEntries =
    role === "superadmin"
      ? SUPERADMIN_NAV
      : role === "admin"
        ? ADMIN_NAV
        : USER_NAV;

  const roleLabel =
    role === "superadmin"
      ? "Super Admin"
      : role === "admin"
        ? "Admin"
        : "Kasir";

  // Auto-buka grup yang berisi halaman aktif saat navigasi
  useEffect(() => {
    const entries =
      role === "superadmin"
        ? SUPERADMIN_NAV
        : role === "admin"
          ? ADMIN_NAV
          : null;
    if (!entries) return;

    entries.forEach((entry) => {
      if (entry.type !== "group") return;
      const hasActive = entry.items.some((item) =>
        isGroupItemActive(item.href, pathname),
      );
      if (hasActive) {
        setOpenGroups((prev) => ({ ...prev, [entry.label]: true }));
      }
    });
  }, [pathname, role]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  const roleBadgeClass =
    role === "superadmin"
      ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
      : role === "admin"
        ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30"
        : "bg-slate-700/60 text-slate-400 ring-1 ring-slate-600/40";

  const displayName = authUser?.name ?? (role === "superadmin" ? "Super Admin" : role === "admin" ? "Admin Toko" : "Kasir");
  const displayEmail = authUser?.email ?? "";

  function getInitials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-50 h-full w-64 flex-shrink-0",
        "flex flex-col text-slate-100",
        "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800/95",
        "transition-transform duration-300 ease-in-out",
        "lg:static lg:z-auto lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/40 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-900/40">
          <ShoppingCart className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm leading-tight truncate tracking-wide">
            Point of Sale
          </p>
          <p className={cn("text-[10px] font-medium leading-tight mt-0.5 px-1.5 py-0.5 rounded-full w-fit", roleBadgeClass)}>
            {roleLabel}
          </p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
          aria-label="Tutup menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 [scrollbar-width:thin] [scrollbar-color:oklch(0.4_0_0/40%)_transparent]">
        <ul className="space-y-0.5">
          {navEntries.map((entry) => {
            if (entry.type === "group") {
              return (
                <NavGroupSection
                  key={entry.label}
                  group={entry}
                  isOpen={openGroups[entry.label] ?? true}
                  onToggle={() => toggleGroup(entry.label)}
                  pathname={pathname}
                  onLinkClick={onClose}
                />
              );
            }

            const active = isStandaloneActive(entry.href, pathname);
            const Icon = entry.icon;
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-indigo-500/20 text-indigo-300 shadow-sm ring-1 ring-indigo-500/30"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {entry.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — user info */}
      <div className="px-3 py-3 border-t border-slate-700/40 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-800/60 transition-colors cursor-default">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow shadow-indigo-900/40">
            {getInitials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
              {displayName}
            </p>
            <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
              {displayEmail || "POS v1.0.0"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
