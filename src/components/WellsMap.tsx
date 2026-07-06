"use client";

import { Home } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, GeoJsonObject } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { deptNamesMatch, fixEncoding, normalizeGeoName } from "@/lib/geo";
import { hasActiveFilters } from "@/lib/filters";
import { useAppPreferences, useT } from "@/context/AppPreferences";
import type { DashboardFilters, WellMapPoint } from "@/lib/types";

const COLOMBIA_CENTER: [number, number] = [4.5, -74.0];
const COLOMBIA_BOUNDS: L.LatLngBoundsExpression = [
  [-4.5, -81.5],
  [13.5, -66.5],
];

const TILE_LAYERS = {
  light: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

function markerColor(status: string | null) {
  switch (status) {
    case "valid":
      return "#16a34a";
    case "warning":
      return "#f59e0b";
    case "invalid":
      return "#e8381a";
    default:
      return "#ff8c00";
  }
}

function getDepartmentBounds(deptGeo: GeoJsonObject | null, departamento: string): L.LatLngBounds | null {
  if (!deptGeo || !("features" in deptGeo)) return null;
  const feature = (deptGeo as FeatureCollection).features.find((f) =>
    deptNamesMatch(f.properties?.DPTO_CNMBR as string, departamento),
  );
  if (!feature) return null;
  const bounds = L.geoJSON(feature).getBounds();
  return bounds.isValid() ? bounds : null;
}

function getDepartmentsBounds(deptGeo: GeoJsonObject | null, departamentos: string[]): L.LatLngBounds | null {
  let bounds: L.LatLngBounds | null = null;
  for (const departamento of departamentos) {
    const deptBounds = getDepartmentBounds(deptGeo, departamento);
    if (!deptBounds) continue;
    bounds = bounds ? bounds.extend(deptBounds) : deptBounds;
  }
  return bounds;
}

const MAP_FIT_PADDING: L.PointExpression = [40, 40];

function fitMapView(
  map: L.Map,
  points: WellMapPoint[],
  deptGeo: GeoJsonObject | null,
  selectedDepartamentos: string[],
) {
  const deptBounds =
    selectedDepartamentos.length > 0 && deptGeo
      ? getDepartmentsBounds(deptGeo, selectedDepartamentos)
      : null;

  if (deptBounds) {
    let bounds = deptBounds;
    if (points.length > 0) {
      const wellBounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
      bounds = deptBounds.extend(wellBounds);
    }
    map.fitBounds(bounds, { padding: MAP_FIT_PADDING, maxZoom: 10 });
    return;
  }

  if (points.length > 0) {
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.18), { padding: MAP_FIT_PADDING, maxZoom: 10 });
    return;
  }

  map.fitBounds(COLOMBIA_BOUNDS, { padding: MAP_FIT_PADDING });
}

function MapBounds({
  points,
  selectedDepartamentos,
  resetViewKey,
  deptGeo,
}: {
  points: WellMapPoint[];
  selectedDepartamentos: string[];
  resetViewKey: number;
  deptGeo: GeoJsonObject | null;
}) {
  const map = useMap();

  useEffect(() => {
    fitMapView(map, points, deptGeo, selectedDepartamentos);
  }, [points, selectedDepartamentos, resetViewKey, deptGeo, map]);

  return null;
}

function ZoomWatcher({ onZoom }: { onZoom: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    map.on("zoomend", handler);
    onZoom(map.getZoom());
    return () => {
      map.off("zoomend", handler);
    };
  }, [map, onZoom]);

  return null;
}

interface WellsMapProps {
  allWells: WellMapPoint[];
  filteredWells: WellMapPoint[];
  filters: DashboardFilters;
  departamentos: string[];
  onFilter: (key: keyof DashboardFilters, value: string) => void;
  onToggleDepartamento: (departamento: string) => void;
  onWellSelect?: (wellId: number) => void;
  loading?: boolean;
}

export default function WellsMap({
  allWells,
  filteredWells,
  filters,
  departamentos,
  onFilter,
  onToggleDepartamento,
  onWellSelect,
  loading,
}: WellsMapProps) {
  const t = useT();
  const { theme } = useAppPreferences();
  const isDark = theme === "dark";
  const tiles = TILE_LAYERS[theme];
  const [deptGeo, setDeptGeo] = useState<GeoJsonObject | null>(null);
  const [muniGeo, setMuniGeo] = useState<FeatureCollection | null>(null);
  const [zoom, setZoom] = useState(5);
  const [resetViewKey, setResetViewKey] = useState(0);
  const crossFilterActive = hasActiveFilters(filters);
  const selectedDepartamentos = filters.departamentos ?? [];
  const showMunicipios = zoom >= 8 || selectedDepartamentos.length > 0;

  const filteredIds = useMemo(() => new Set(filteredWells.map((w) => w.id)), [filteredWells]);

  const deptWellCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const well of filteredWells) {
      if (!well.departamento) continue;
      const key = normalizeGeoName(well.departamento);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [filteredWells]);

  const backgroundWells = useMemo(
    () => (crossFilterActive ? allWells.filter((w) => !filteredIds.has(w.id)) : []),
    [allWells, crossFilterActive, filteredIds],
  );

  useEffect(() => {
    fetch("/geo/colombia-departamentos.geojson")
      .then((r) => r.json())
      .then(setDeptGeo)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!showMunicipios || muniGeo) return;
    fetch("/geo/colombia-municipios.geojson")
      .then((r) => r.json())
      .then(setMuniGeo)
      .catch(console.error);
  }, [showMunicipios, muniGeo]);

  const filteredMuniGeo = useMemo(() => {
    if (!muniGeo) return null;
    if (selectedDepartamentos.length === 0) return muniGeo;
    return {
      ...muniGeo,
      features: muniGeo.features.filter((feature) =>
        selectedDepartamentos.some((departamento) =>
          deptNamesMatch(feature.properties?.DPTO_CNMBR as string, departamento),
        ),
      ),
    };
  }, [muniGeo, selectedDepartamentos]);

  const findDeptName = useCallback(
    (geoName: string) => departamentos.find((d) => deptNamesMatch(d, geoName)) ?? geoName,
    [departamentos],
  );

  const deptStyle = useCallback(
    (feature?: Feature) => {
      const geoName = feature?.properties?.DPTO_CNMBR as string | undefined;
      const normalized = geoName ? normalizeGeoName(geoName) : "";
      const wellCount = deptWellCounts.get(normalized) ?? 0;
      const selected = Boolean(
        geoName && selectedDepartamentos.some((departamento) => deptNamesMatch(geoName, departamento)),
      );

      if (selected) {
        return {
          fillColor: "#ff8c00",
          fillOpacity: 0.42,
          color: "#e8381a",
          weight: 2.2,
          opacity: 0.95,
        };
      }

      if (crossFilterActive && wellCount === 0) {
        return isDark
          ? {
              fillColor: "#1a1a1a",
              fillOpacity: 0.35,
              color: "#404040",
              weight: 0.5,
              opacity: 0.35,
            }
          : {
              fillColor: "#e8eef2",
              fillOpacity: 0.08,
              color: "#1a1a1a",
              weight: 0.5,
              opacity: 0.2,
            };
      }

      const intensity = crossFilterActive ? Math.min(0.15 + wellCount * 0.04, 0.45) : isDark ? 0.22 : 0.14;
      return {
        fillColor: "#ffe600",
        fillOpacity: intensity,
        color: isDark ? "#737373" : "#1a1a1a",
        weight: wellCount > 0 ? 1 : 0.6,
        opacity: crossFilterActive ? (isDark ? 0.7 : 0.55) : isDark ? 0.55 : 0.4,
      };
    },
    [crossFilterActive, deptWellCounts, isDark, selectedDepartamentos],
  );

  const muniStyle = useMemo(
    () =>
      isDark
        ? {
            fillColor: "#262626",
            fillOpacity: 0.35,
            color: "#404040",
            weight: 0.45,
            opacity: 0.55,
          }
        : {
            fillColor: "#ffffff",
            fillOpacity: 0.04,
            color: "#555555",
            weight: 0.45,
            opacity: 0.45,
          },
    [isDark],
  );

  const handleZoom = useCallback((value: number) => setZoom(value), []);

  const renderWellPopup = (well: WellMapPoint, highlighted: boolean) => (
    <Popup>
      <div className="min-w-[220px] text-sm text-anh-text">
        <p className="font-bold">{well.nombre_pozo_sgc ?? t("map.noName")}</p>
        <p className="font-mono text-xs text-anh-muted">{well.uwi_fiscalizado ?? t("common.none")}</p>
        <hr className="my-1.5 border-anh-border" />
        <p>
          <strong>{t("common.operator")}:</strong> {well.operadora ?? t("common.none")}
        </p>
        <p>
          <strong>{t("common.department")}:</strong> {fixEncoding(well.departamento ?? t("common.none"))}
        </p>
        <p>
          <strong>{t("map.popupMunicipio")}:</strong> {fixEncoding(well.municipio ?? t("common.none"))}
        </p>
        <p>
          <strong>{t("common.state")}:</strong> {well.estado_pozo ?? t("common.none")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded bg-anh-bg px-2 py-0.5 text-[10px] font-semibold hover:bg-anh-secondary/20"
            onClick={() => well.nombre_pozo_sgc && onFilter("q", well.nombre_pozo_sgc)}
          >
            {t("map.popupFilterWell")}
          </button>
          {well.operadora && (
            <button
              type="button"
              className="rounded bg-anh-bg px-2 py-0.5 text-[10px] font-semibold hover:bg-anh-secondary/20"
              onClick={() => onFilter("operadora", well.operadora!)}
            >
              {t("map.popupOperator")}
            </button>
          )}
          {well.departamento && (
            <button
              type="button"
              className="rounded bg-anh-bg px-2 py-0.5 text-[10px] font-semibold hover:bg-anh-secondary/20"
              onClick={() => onToggleDepartamento(well.departamento!)}
            >
              {t("map.popupDepartment")}
            </button>
          )}
          {well.estado_pozo && (
            <button
              type="button"
              className="rounded bg-anh-bg px-2 py-0.5 text-[10px] font-semibold hover:bg-anh-secondary/20"
              onClick={() => onFilter("estado", well.estado_pozo!)}
            >
              {t("map.popupState")}
            </button>
          )}
        </div>
        {!highlighted && crossFilterActive && (
          <p className="mt-1 text-[10px] text-anh-muted">{t("map.popupNoMatch")}</p>
        )}
      </div>
    </Popup>
  );

  return (
    <div
      className="map-shell relative isolate overflow-hidden rounded-xl border border-anh-border min-h-[280px] sm:min-h-[360px]"
    >
      {loading && (
        <div className="map-loading-overlay absolute inset-0 z-[1000] flex items-center justify-center text-sm font-semibold text-anh-muted">
          {t("common.updatingMap")}
        </div>
      )}
      <MapContainer
        center={COLOMBIA_CENTER}
        zoom={5}
        minZoom={5}
        maxZoom={12}
        className="h-[min(45vh,420px)] w-full sm:h-[min(52vh,480px)]"
        scrollWheelZoom
      >
        <TileLayer attribution={tiles.attribution} url={tiles.url} />
        {deptGeo && (
          <GeoJSON
            key={`dept-${selectedDepartamentos.join("|")}-${filteredWells.length}-${theme}`}
            data={deptGeo}
            style={deptStyle}
            onEachFeature={(feature, layer) => {
              const geoName = feature.properties?.DPTO_CNMBR as string;
              const matched = findDeptName(geoName);
              const count = deptWellCounts.get(normalizeGeoName(matched)) ?? 0;
              layer.bindTooltip(
                crossFilterActive
                  ? t("map.deptWells", { name: fixEncoding(geoName), count })
                  : fixEncoding(geoName),
                { sticky: true },
              );
              layer.on("click", () => onToggleDepartamento(matched));
            }}
          />
        )}
        {showMunicipios && filteredMuniGeo && (
          <GeoJSON
            key={`muni-${selectedDepartamentos.join("|")}-${zoom}-${theme}`}
            data={filteredMuniGeo}
            style={muniStyle}
          />
        )}
        {backgroundWells.map((well) => (
          <CircleMarker
            key={`bg-${well.id}`}
            center={[well.lat, well.lng]}
            radius={4}
            pathOptions={{
              color: isDark ? "#525252" : "#94a3b8",
              fillColor: isDark ? "#3f3f3f" : "#cbd5e1",
              fillOpacity: isDark ? 0.65 : 0.55,
              weight: 1,
            }}
            eventHandlers={{
              click: () => onWellSelect?.(well.id),
            }}
          >
            {renderWellPopup(well, false)}
          </CircleMarker>
        ))}
        {filteredWells.map((well) => (
          <CircleMarker
            key={well.id}
            center={[well.lat, well.lng]}
            radius={crossFilterActive ? 8 : filteredWells.length > 200 ? 5 : 7}
            pathOptions={{
              color: isDark ? "#f5f5f5" : "#1a1a1a",
              fillColor: markerColor(well.validation_status),
              fillOpacity: 0.95,
              weight: crossFilterActive ? 2 : 1,
            }}
            eventHandlers={{
              click: () => onWellSelect?.(well.id),
            }}
          >
            {renderWellPopup(well, true)}
          </CircleMarker>
        ))}
        <MapBounds
          points={filteredWells}
          selectedDepartamentos={selectedDepartamentos}
          resetViewKey={resetViewKey}
          deptGeo={deptGeo}
        />
        <ZoomWatcher onZoom={handleZoom} />
      </MapContainer>
      <button
        type="button"
        onClick={() => setResetViewKey((key) => key + 1)}
        className="map-legend absolute left-11 top-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg shadow-md transition hover:bg-anh-bg sm:left-auto sm:right-3"
        title={t("map.resetView")}
        aria-label={t("map.resetView")}
      >
        <Home className="h-4 w-4 text-anh-primary" />
      </button>
      <div className="map-legend absolute right-3 top-3 z-[1000] max-w-[calc(100%-5.5rem)] rounded-lg px-3 py-2 text-xs shadow-md sm:bottom-3 sm:left-3 sm:right-auto sm:top-auto sm:max-w-[calc(100%-1.5rem)]">
        <div className="mb-1 font-semibold text-anh-primary">{t("map.legendTitle")}</div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: t("map.legendValid"), color: "#16a34a", status: "valid" },
            { label: t("map.legendWarning"), color: "#f59e0b", status: "warning" },
            { label: t("map.legendError"), color: "#e8381a", status: "invalid" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onFilter("validation_status", item.status)}
              className={`flex items-center gap-1.5 rounded px-1 py-0.5 transition ${
                filters.validation_status === item.status ? "bg-anh-bg font-bold ring-1 ring-anh-secondary" : "hover:bg-anh-bg/70"
              }`}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
          {crossFilterActive && (
            <span className="flex items-center gap-1.5 text-anh-muted">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: isDark ? "#3f3f3f" : "#cbd5e1" }}
              />
              {t("map.legendUnfiltered", { count: backgroundWells.length })}
            </span>
          )}
        </div>
        <p className="mt-1 text-[10px] text-anh-muted">{t("map.legendHint")}</p>
      </div>
    </div>
  );
}
