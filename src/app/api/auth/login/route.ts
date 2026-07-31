import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, sessionCookieOptions } from "@/lib/auth-crypto";
import { resolveLoginIdentity, writeAuditLog } from "@/lib/auth-db";
import { resolveLoginEmail, SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { getServerDemoCredentials, isDemoLoginEnabled } from "@/lib/demo-auth-server";
import { checkRateLimit, pruneRateLimitBuckets } from "@/lib/rate-limit";
import type { UserRole } from "@/lib/types";

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `login:${ip}`;
}

export async function POST(request: NextRequest) {
  pruneRateLimitBuckets();
  const limit = checkRateLimit(clientKey(request), 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intente de nuevo más tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  const body = (await request.json()) as {
    role: UserRole;
    email?: string;
    username?: string;
    operadora?: string;
    password?: string;
    demo?: boolean;
  };

  const { role } = body;
  if (!role) {
    return NextResponse.json({ error: "Credenciales incompletas" }, { status: 400 });
  }

  let password = body.password ?? "";
  let identityInput = {
    email: body.email,
    username: body.username,
    operadora: body.operadora,
  };

  if (body.demo) {
    if (!isDemoLoginEnabled()) {
      return NextResponse.json({ error: "Acceso demo deshabilitado" }, { status: 403 });
    }
    const demo = getServerDemoCredentials(role);
    password = demo.password;
    identityInput = {
      email: demo.email,
      username: demo.username,
      operadora: demo.operadora,
    };
  }

  if (!password) {
    return NextResponse.json({ error: "Credenciales incompletas" }, { status: 400 });
  }

  const identity = resolveLoginEmail(role, identityInput);
  if (!identity) {
    return NextResponse.json({ error: "Datos de acceso inválidos" }, { status: 400 });
  }

  const user = resolveLoginIdentity(role, identity.email, identity.username, identity.operadora);
  if (!user || !verifyPassword(password, user.password_hash)) {
    writeAuditLog({
      actorEmail: identity.email,
      action: "auth.login.failed",
      entityType: "auth",
      entityId: null,
      after: { role, reason: "invalid_credentials" },
    });
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  writeAuditLog({
    actorEmail: user.email,
    action: "auth.login.success",
    entityType: "auth",
    entityId: user.id,
    after: { role: user.role, demo: Boolean(body.demo) },
  });

  const token = createSessionToken(user.id);
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      operadora: user.operadora,
      displayName: user.display_name ?? user.username,
    },
  });

  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
