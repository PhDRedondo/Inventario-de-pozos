/** Capa satelital Esri World Imagery (sin API key, uso permitido con atribución). */
export const ESRI_WORLD_IMAGERY = {
  tileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  exportUrl:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export",
  attribution:
    "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
} as const;

export const SATELLITE_MAP_ZOOM = 11;
export const SATELLITE_MAP_WIDTH = 800;
export const SATELLITE_MAP_HEIGHT = 420;

const EARTH_RADIUS_M = 6378137;

export interface SatelliteBoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/** Calcula un bbox geográfico centrado en lat/lng para el zoom y tamaño de imagen dados. */
export function satelliteMapBoundingBox(
  lat: number,
  lng: number,
  widthPx: number,
  heightPx: number,
  zoom: number,
): SatelliteBoundingBox {
  const latRad = (lat * Math.PI) / 180;
  const metersPerPixel = (Math.cos(latRad) * 2 * Math.PI * EARTH_RADIUS_M) / (256 * 2 ** zoom);
  const halfWidthM = (widthPx / 2) * metersPerPixel;
  const halfHeightM = (heightPx / 2) * metersPerPixel;
  const deltaLat = (halfHeightM / EARTH_RADIUS_M) * (180 / Math.PI);
  const deltaLng = (halfWidthM / (EARTH_RADIUS_M * Math.cos(latRad))) * (180 / Math.PI);

  return {
    minLng: lng - deltaLng,
    minLat: lat - deltaLat,
    maxLng: lng + deltaLng,
    maxLat: lat + deltaLat,
  };
}

export function buildEsriSatelliteExportUrl(
  lat: number,
  lng: number,
  width = SATELLITE_MAP_WIDTH,
  height = SATELLITE_MAP_HEIGHT,
  zoom = SATELLITE_MAP_ZOOM,
): string {
  const bbox = satelliteMapBoundingBox(lat, lng, width, height, zoom);
  const params = new URLSearchParams({
    dpi: "96",
    transparent: "false",
    format: "png",
    layers: "show:0",
    bbox: `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`,
    bboxSR: "4326",
    imageSR: "4326",
    size: `${width},${height}`,
    f: "image",
  });

  return `${ESRI_WORLD_IMAGERY.exportUrl}?${params.toString()}`;
}

export function getWellSatelliteMapApiUrl(lat: number, lng: number): string {
  return `/api/wells/map-image?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`;
}
