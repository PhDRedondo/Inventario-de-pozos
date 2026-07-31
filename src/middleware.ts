import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_ABSOLUTE_MS,
  SESSION_COOKIE,
  refreshSessionTokenEdge,
  shouldRefreshSessionEdge,
  verifySessionTokenEdge,
} from "@/lib/session-edge";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/api/auth/login",
  "/api/auth/config",
  "/api/catalogs",
  "/api/public/landing-stats",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/public/")) return true;
  return false;
}

function isMutating(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

/** Rechaza orígenes cruzados en mutaciones autenticadas (CSRF básico). */
function hasTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get("host");
    return Boolean(host && originHost === host);
  } catch {
    return false;
  }
}

function sessionCookieAttrs() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/anh-logo") ||
    pathname.startsWith("/geo/") ||
    pathname.match(/\.(png|jpg|svg|ico|geojson)$/)
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (isMutating(request.method) && pathname.startsWith("/api/") && !hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySessionTokenEdge(token) : null;

  if (!claims) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  if (shouldRefreshSessionEdge(claims)) {
    const refreshed = await refreshSessionTokenEdge(claims);
    response.cookies.set(SESSION_COOKIE, refreshed, sessionCookieAttrs());
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
