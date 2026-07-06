import { NextRequest, NextResponse } from "next/server";
import { getOperadorasSummary } from "@/lib/db";
import { buildDataScope, requireSession } from "@/lib/auth-scope";

export async function GET(request: NextRequest) {
  const user = requireSession(request);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json(getOperadorasSummary(buildDataScope(user)));
}
