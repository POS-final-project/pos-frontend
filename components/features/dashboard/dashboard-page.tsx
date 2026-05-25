"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, ShoppingCart, RotateCcw, Package,
  AlertTriangle, Store, RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { PageHeader } from "@/components/layout/page-header";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardData = {
  revenue: { today: number; this_month: number };
  transactions: { today: number; this_month: number; refunded_this_month: number };
  trend: { date: string; revenue: number; count: number }[];
  top_products: {
    product_name: string;
    variant_name: string;
    sku: string;
    total_qty: number;
    total_revenue: number;
  }[];
  payment_breakdown: { payment_method: string; count: number; revenue: number }[];
  low_stock: {
    shop_name: string;
    product_name: string;
    variant_name: string;
    sku: string;
    stock: number;
    reserved_stock: number;
    threshold: number;
  }[];
};

type Shop = { id: string; name: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    notation: n >= 1_000_000 ? "compact" : "standard",
    compactDisplay: "short",
  }).format(n);
}

function formatRpFull(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: "indigo" | "emerald" | "amber" | "red";
}) {
  const palette = {
    indigo: { bg: "bg-indigo-50",  icon: "text-indigo-600",  val: "text-indigo-700" },
    emerald:{ bg: "bg-emerald-50", icon: "text-emerald-600", val: "text-emerald-700" },
    amber:  { bg: "bg-amber-50",   icon: "text-amber-600",   val: "text-amber-700"  },
    red:    { bg: "bg-red-50",     icon: "text-red-600",     val: "text-red-700"    },
  }[color];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${palette.val}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg ${palette.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${palette.icon}`} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">{title}</p>
      {children}
    </div>
  );
}

// Custom tooltip for revenue charts
function RevenueTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-slate-500 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold text-slate-800">
          {p.name === "revenue" ? formatRpFull(p.value) : `${p.value} transaksi`}
        </p>
      ))}
    </div>
  );
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: "#64748b",
  qris: "#7c3aed",
};
const PAYMENT_LABELS: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashboardPage({ role }: { role: "admin" | "superadmin" }) {
  const user = getUser();

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load shops for superadmin selector
  useEffect(() => {
    if (role !== "superadmin") return;
    api.get<{ success: boolean; data: Shop[] }>("/api/shops?page=1&limit=100")
      .then((res) => setShops(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [role]);

  const fetchData = useCallback(async (shopId: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (shopId) params.set("shopId", shopId);
      const res = await api.get<{ data: DashboardData }>(
        `/api/dashboard/summary${shopId ? `?shopId=${shopId}` : ""}`,
      );
      const raw = res as unknown as { data: DashboardData };
      setData(raw.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  // Admin: auto-fetch (shopAccess handles shop inference)
  // Superadmin: fetch when selectedShopId changes (empty = all shops)
  useEffect(() => {
    if (role === "admin") {
      void fetchData("");
    }
  }, [role, fetchData]);

  useEffect(() => {
    if (role === "superadmin") {
      void fetchData(selectedShopId);
    }
  }, [role, selectedShopId, fetchData]);

  // ── Render: loading skeleton ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Ringkasan performa toko"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
              <div className="h-7 w-32 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 animate-pulse h-64" />
          <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse h-64" />
        </div>
      </div>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Ringkasan performa toko" />
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="font-medium text-red-700">{error}</p>
          </div>
          <button
            onClick={() => fetchData(selectedShopId)}
            className="ml-auto flex items-center gap-2 text-sm text-red-600 hover:text-red-800"
          >
            <RefreshCw className="w-4 h-4" /> Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { revenue, transactions, trend, top_products, payment_breakdown, low_stock } = data;

  // Prepare pie data
  const pieData = payment_breakdown.map((p) => ({
    name: PAYMENT_LABELS[p.payment_method] ?? p.payment_method,
    value: p.count,
    revenue: p.revenue,
    key: p.payment_method,
  }));

  // Prepare bar data — truncate long names
  const barData = top_products.map((p) => ({
    name: `${p.product_name}${p.variant_name !== p.product_name ? ` · ${p.variant_name}` : ""}`,
    qty: p.total_qty,
    revenue: p.total_revenue,
  }));

  const totalTx = (payment_breakdown.reduce((s, p) => s + p.count, 0)) || 1;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <PageHeader
          title="Dashboard"
          description={
            role === "superadmin"
              ? "Ringkasan performa seluruh bisnis"
              : "Ringkasan performa toko Anda"
          }
        />

        {/* Shop selector — superadmin only */}
        {role === "superadmin" && (
          <div className="flex items-center gap-2 shrink-0">
            <Store className="w-4 h-4 text-slate-400" />
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Semua Toko</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pendapatan Hari Ini"
          value={formatRp(revenue.today)}
          icon={TrendingUp}
          color="indigo"
        />
        <StatCard
          label="Pendapatan Bulan Ini"
          value={formatRp(revenue.this_month)}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          label="Transaksi Hari Ini"
          value={String(transactions.today)}
          sub="transaksi selesai"
          icon={ShoppingCart}
          color="amber"
        />
        <StatCard
          label="Transaksi Bulan Ini"
          value={String(transactions.this_month)}
          sub={
            transactions.refunded_this_month > 0
              ? `${transactions.refunded_this_month} direfund`
              : "transaksi selesai"
          }
          icon={transactions.refunded_this_month > 0 ? RotateCcw : ShoppingCart}
          color={transactions.refunded_this_month > 0 ? "red" : "amber"}
        />
      </div>

      {/* ── Revenue Trend + Payment Pie ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Area chart: tren 14 hari */}
        <div className="lg:col-span-2">
          <ChartCard title="Tren Pendapatan — 14 Hari Terakhir">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  tickFormatter={(v: number) => formatRp(v)}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#gradRevenue)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Pie chart: metode pembayaran */}
        <ChartCard title="Metode Pembayaran — Bulan Ini">
          {pieData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
              Belum ada transaksi bulan ini
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={PAYMENT_COLORS[entry.key] ?? "#cbd5e1"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} transaksi (${Math.round((value / totalTx) * 100)}%)`,
                    name,
                  ]}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: "#475569" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Top Products ─────────────────────────────────────────────────────── */}
      <ChartCard title="Top 5 Produk Terlaris — Bulan Ini">
        {barData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">
            Belum ada data penjualan bulan ini
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 52)}>
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                dataKey="qty"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={{ fontSize: 11, fill: "#475569" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === "qty" ? `${value} unit` : formatRpFull(value),
                  name === "qty" ? "Terjual" : "Revenue",
                ]}
              />
              <Bar dataKey="qty" name="qty" fill="#10b981" radius={[0, 4, 4, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Low Stock Alert ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Stok Kritis</p>
            <p className="text-xs text-slate-400">
              {low_stock.length === 0
                ? "Semua stok dalam kondisi aman"
                : `${low_stock.length} item stok di bawah atau sama dengan threshold`}
            </p>
          </div>
        </div>

        {low_stock.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-400">
            <Package className="w-4 h-4" />
            Tidak ada stok yang perlu diperhatikan saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide bg-slate-50/80">
                  {role === "superadmin" && <th className="text-left px-5 py-2.5 font-medium">Toko</th>}
                  <th className="text-left px-5 py-2.5 font-medium">Produk</th>
                  <th className="text-left px-5 py-2.5 font-medium">SKU</th>
                  <th className="text-right px-5 py-2.5 font-medium">Stok</th>
                  <th className="text-right px-5 py-2.5 font-medium">Threshold</th>
                  <th className="text-right px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {low_stock.map((item, i) => {
                  const critical = item.stock === 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      {role === "superadmin" && (
                        <td className="px-5 py-3 text-slate-600">{item.shop_name}</td>
                      )}
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{item.product_name}</p>
                        <p className="text-xs text-slate-400">{item.variant_name}</p>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.sku}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`font-bold ${
                            critical ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          {item.stock}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">{item.threshold}</td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                            critical
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {critical ? "Habis" : "Kritis"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
