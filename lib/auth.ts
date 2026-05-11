import { getCookie, setCookie, removeCookie } from "./cookies";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "user";
  shopId?: string | null;
};

const KEYS = {
  accessToken: "pos_access_token",
  refreshToken: "pos_refresh_token",
  user: "pos_user",
} as const;

export function setAuth(accessToken: string, refreshToken: string, user: AuthUser) {
  setCookie(KEYS.accessToken, accessToken);
  setCookie(KEYS.refreshToken, refreshToken);
  setCookie(KEYS.user, JSON.stringify(user));
}

export function clearAuth() {
  removeCookie(KEYS.accessToken);
  removeCookie(KEYS.refreshToken);
  removeCookie(KEYS.user);
}

export function getAccessToken(): string | null {
  return getCookie(KEYS.accessToken);
}

export function getUser(): AuthUser | null {
  const raw = getCookie(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getRoleRedirect(role: AuthUser["role"]): string {
  const map: Record<AuthUser["role"], string> = {
    superadmin: "/superadmin",
    admin: "/admin",
    user: "/user",
  };
  return map[role] ?? "/login";
}
