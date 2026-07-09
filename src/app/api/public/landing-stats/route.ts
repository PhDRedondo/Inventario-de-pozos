import { NextResponse } from "next/server";
import { getLandingStats } from "@/lib/landing-stats";

export async function GET() {
  return NextResponse.json(getLandingStats());
}
