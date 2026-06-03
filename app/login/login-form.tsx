"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { setAuth, getRoleRedirect, type AuthUser } from "@/lib/auth";
import { setCookie } from "@/lib/cookies";

type LoginResponse = {
  success: boolean;
  data: { accessToken: string; refreshToken: string };
};

type ProfileResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    email: string;
    role: AuthUser["role"];
    shopId?: string | null;
  };
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const login = await api.post<LoginResponse>("/api/auth/login", {
        email,
        password,
      });

      // Store tokens so api.get can attach Bearer on the profile call
      setCookie("pos_access_token", login.data.accessToken);

      const profile = await api.get<ProfileResponse>("/api/profile");

      // Normalize role to lowercase (backend may return "SUPERADMIN" etc.)
      const rawRole = (profile.data.role as string)?.toLowerCase() as AuthUser["role"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shopId = profile.data.shopId ?? (profile.data as any).shop_id ?? null;

      const user: AuthUser = {
        id: profile.data.id,
        name: profile.data.name,
        email: profile.data.email,
        role: rawRole,
        shopId,
      };

      setAuth(login.data.accessToken, login.data.refreshToken, user);
      router.push(getRoleRedirect(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Alamat email Anda"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200/80 rounded-lg px-3 py-2.5 flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Memproses..." : "Masuk"}
      </Button>
    </form>
  );
}
