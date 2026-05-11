import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type Role = "superadmin" | "admin" | "user";

const ROLE_HOME: Record<Role, string> = {
  superadmin: "/superadmin",
  admin: "/admin",
  user: "/user",
};

function getRole(request: NextRequest): Role | null {
  const raw = request.cookies.get("pos_user")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { role?: string };
    const role = parsed.role?.toLowerCase();
    if (role === "superadmin" || role === "admin" || role === "user")
      return role;
  } catch {
    // invalid cookie
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasToken = Boolean(request.cookies.get("pos_access_token")?.value);

  // Redirect authenticated users away from /login
  if (pathname === "/login" || pathname === "/") {
    if (hasToken) {
      const role = getRole(request);
      const home = role ? ROLE_HOME[role] : "/login";
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  // Protected role routes
  const isProtected =
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/user");

  if (!isProtected) return NextResponse.next();

  // Not authenticated → login
  if (!hasToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = getRole(request);

  // No parseable role → login
  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowed =
    (pathname.startsWith("/superadmin") && role === "superadmin") ||
    (pathname.startsWith("/admin") && role === "admin") ||
    (pathname.startsWith("/user") && role === "user");

  if (!allowed) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|backend).*)",
  ],
};
