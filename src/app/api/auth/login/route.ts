import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth-crypto";
import { resolveLoginIdentity } from "@/lib/auth-db";
import { resolveLoginEmail, SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    role: UserRole;
    email?: string;
    username?: string;
    operadora?: string;
    password: string;
  };

  const { role, password } = body;
  if (!role || !password) {
    return NextResponse.json({ error: "Credenciales incompletas" }, { status: 400 });
  }

  const identity = resolveLoginEmail(role, body);
  if (!identity) {
    return NextResponse.json({ error: "Datos de acceso inválidos" }, { status: 400 });
  }

  const user = resolveLoginIdentity(role, identity.email, identity.username, identity.operadora);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

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

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}
