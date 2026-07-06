import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getUserById, resolveLoginIdentity } from "./auth-db";
import {
  SESSION_COOKIE,
  buildAnhEmail,
  buildOperadoraEmail,
  createSessionToken,
  verifySessionToken,
} from "./auth-crypto";
import type { SessionUser, UserRole } from "./types";

function toSessionUser(user: {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  operadora: string | null;
  display_name: string | null;
}): SessionUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    operadora: user.operadora,
    displayName: user.display_name ?? user.username,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user || !user.active) return null;
  return toSessionUser(user);
}

export function getSessionUserFromRequest(request: NextRequest): SessionUser | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = getUserById(userId);
  if (!user || !user.active) return null;
  return toSessionUser(user);
}

export function resolveLoginEmail(
  role: UserRole,
  input: { email?: string; username?: string; operadora?: string },
): { email: string; username: string; operadora: string | null } | null {
  if (role === "admin") {
    const email = input.email?.trim().toLowerCase();
    if (!email) return null;
    return { email, username: email.split("@")[0] ?? email, operadora: null };
  }
  if (role === "anh") {
    const username = input.username?.trim();
    if (!username) return null;
    return { email: buildAnhEmail(username), username: username.toLowerCase(), operadora: null };
  }
  if (role === "operadora") {
    const username = input.username?.trim();
    const operadora = input.operadora?.trim();
    if (!username || !operadora) return null;
    return {
      email: buildOperadoraEmail(username, operadora),
      username: username.toLowerCase(),
      operadora,
    };
  }
  return null;
}

export { SESSION_COOKIE, createSessionToken, resolveLoginIdentity };
