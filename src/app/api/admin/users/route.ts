import { NextRequest, NextResponse } from "next/server";
import { buildAnhEmail, buildOperadoraEmail } from "@/lib/auth-crypto";
import { createUser, listUsers } from "@/lib/auth-db";
import { requireRole, requireSession } from "@/lib/auth-scope";
import type { UserRole } from "@/lib/types";

export async function GET(request: NextRequest) {
  const user = requireRole(requireSession(request), ["admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return NextResponse.json(listUsers().map(({ password_hash: _, ...u }) => u));
}

export async function POST(request: NextRequest) {
  const user = requireRole(requireSession(request), ["admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await request.json()) as {
    role: UserRole;
    username: string;
    email?: string;
    operadora?: string;
    password: string;
    displayName?: string;
  };

  const { role, username, password, displayName } = body;
  if (!role || !username || !password) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  let email = body.email?.trim().toLowerCase();
  let operadora = body.operadora?.trim() ?? null;

  if (role === "anh") {
    email = buildAnhEmail(username);
  } else if (role === "operadora") {
    if (!operadora) return NextResponse.json({ error: "Operadora requerida" }, { status: 400 });
    email = buildOperadoraEmail(username, operadora);
  } else if (!email) {
    return NextResponse.json({ error: "Correo requerido para administrador" }, { status: 400 });
  }

  try {
    const created = createUser({
      email: email!,
      username: username.toLowerCase(),
      role,
      operadora,
      password,
      displayName,
      createdBy: user.email,
    });
    const { password_hash: _, ...safe } = created;
    return NextResponse.json(safe, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo crear el usuario (¿correo duplicado?)" }, { status: 409 });
  }
}
