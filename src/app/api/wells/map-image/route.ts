import { buildEsriSatelliteExportUrl } from "@/lib/satellite-map";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Coordenadas inválidas" }, { status: 400 });
  }

  const url = buildEsriSatelliteExportUrl(lat, lng);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "inventario-pozos-anh/1.0 (ANH GOP)" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Mapa satelital no disponible" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("image")) {
      return NextResponse.json({ error: "Respuesta inválida del proveedor satelital" }, { status: 502 });
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 1024) {
      return NextResponse.json({ error: "Imagen satelital vacía" }, { status: 502 });
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Mapa satelital no disponible" }, { status: 502 });
  }
}
