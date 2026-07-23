import { NextRequest, NextResponse } from "next/server";
import { listAuditLog } from "@/lib/auth-db";
import { requireRole, requireSession } from "@/lib/auth-scope";

export async function GET(request: NextRequest) {
  const user = requireRole(requireSession(request), ["admin"]);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam === "50" ? 50 : 20;
  return NextResponse.json(listAuditLog(limit));
}
