import { NextRequest, NextResponse } from "next/server";
import { buildDataScope, requireRole, requireSession } from "@/lib/auth-scope";
import { getLatestDraftUpload } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = requireRole(requireSession(request), ["operadora"]);
  if (!user) return NextResponse.json({ upload: null });

  const upload = getLatestDraftUpload(buildDataScope(user));
  return NextResponse.json({ upload });
}
