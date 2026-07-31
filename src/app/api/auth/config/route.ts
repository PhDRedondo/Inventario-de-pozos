import { NextResponse } from "next/server";
import { isDemoLoginEnabled } from "@/lib/demo-auth-server";

export async function GET() {
  return NextResponse.json({
    demoLoginEnabled: isDemoLoginEnabled(),
  });
}
