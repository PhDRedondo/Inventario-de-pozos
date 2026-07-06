import type { WellRecord } from "./types";

export function parseWellCoordinates(well: WellRecord): { lat: number; lng: number } | null {
  if (!well.latitud || !well.longitud) return null;

  const lat = Number(String(well.latitud).replace(/,/g, "").trim());
  const lng = Number(String(well.longitud).replace(/,/g, "").trim());

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat, lng };
}
