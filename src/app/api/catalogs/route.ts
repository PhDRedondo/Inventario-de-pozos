import { NextResponse } from "next/server";
import { getCatalogs } from "@/lib/db";

export async function GET() {
  return NextResponse.json(getCatalogs());
}
