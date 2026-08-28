"use client";

import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import { deptNamesMatch } from "@/lib/geo";

type Cell = { key: string; label: string; ratio: number; raw: number };
type Row = { name: string; sampleSize: number; cells: Cell[] };

export interface AnalyticsChoroplethProps {
  /** Filas por departamento (heatmapDept): nombre + muestra + celdas por métrica. */
  rows: Row[];
  /** Métrica inicial (p. ej. `pct_activo`); cae a la primera si no existe. */
  defaultMetricKey?: string;
  /** Escala de color relativa al promedio nacional (100%). */
  colorFor: (ratio: number) => string;
  locale: string;
  labels: {
    metric: string;
    vsNational: string;
    noSample: string;
    sample: (count: number) => string;
  };
}

const NEUTRAL = "#e5e7eb";
const LEGEND: { at: number; text: string }[] = [
  { at: 60, text: "<70%" },
  { at: 80, text: "70–90%" },
  { at: 100, text: "90–110%" },
  { at: 120, text: "110–130%" },
  { at: 140, text: "≥130%" },
];

/**
 * Coropleto de los departamentos de Colombia coloreados por un indicador de la
 * analítica frente al promedio nacional (100%). Reemplaza la tabla de calor
 * «por departamento» aprovechando la dimensión geográfica.
 */
export default function AnalyticsChoropleth({
  rows,
  defaultMetricKey,
  colorFor,
  locale,
  labels,
}: AnalyticsChoroplethProps) {
  const [geo, setGeo] = useState<FeatureCollection | null>(null);

  const metricOptions = useMemo(
    () => rows[0]?.cells.map((c) => ({ key: c.key, label: c.label })) ?? [],
    [rows],
  );

  const pickDefault = () =>
    defaultMetricKey && metricOptions.some((m) => m.key === defaultMetricKey)
      ? defaultMetricKey
      : metricOptions[0]?.key ?? "";

  const [metricKey, setMetricKey] = useState<string>(pickDefault);

  // Mantener una métrica válida si cambian las métricas del tema activo.
  useEffect(() => {
    if (metricOptions.length && !metricOptions.some((m) => m.key === metricKey)) {
      setMetricKey(pickDefault());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricOptions]);

  useEffect(() => {
    let alive = true;
    fetch("/geo/colombia-departamentos.geojson")
      .then((r) => r.json())
      .then((d: FeatureCollection) => alive && setGeo(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const rowFor = (geoName: string): Row | null =>
    rows.find((r) => deptNamesMatch(r.name, geoName)) ?? null;

  const tooltipHtml = (geoName: string): string => {
    const row = rowFor(geoName);
    const cell = row?.cells.find((c) => c.key === metricKey) ?? null;
    if (!row || !cell) {
      return `<strong>${geoName}</strong><br/><small>${labels.noSample}</small>`;
    }
    return (
      `<strong>${geoName}</strong><br/>` +
      `${cell.label}: <strong>${cell.raw.toLocaleString(locale)}</strong><br/>` +
      `${cell.ratio.toFixed(0)}% ${labels.vsNational}<br/>` +
      `<small>${labels.sample(row.sampleSize)}</small>`
    );
  };

  return (
    <div>
      <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-anh-muted">
        {labels.metric}
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
          className="rounded-md border border-anh-border bg-anh-card px-2 py-1 text-xs font-normal text-anh-primary"
        >
          {metricOptions.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-hidden rounded-lg border border-anh-border" style={{ height: 420 }}>
        {geo && (
          <MapContainer
            center={[4.6, -73.8]}
            zoom={5}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution="© OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <GeoJSON
              key={metricKey}
              data={geo}
              style={(feature) => {
                const name = (feature?.properties?.DPTO_CNMBR as string) ?? "";
                const cell = rowFor(name)?.cells.find((c) => c.key === metricKey) ?? null;
                return cell
                  ? { color: "#1e3a4a", weight: 1, fillColor: colorFor(cell.ratio), fillOpacity: 0.7 }
                  : { color: "#cbd5e1", weight: 1, fillColor: NEUTRAL, fillOpacity: 0.25 };
              }}
              onEachFeature={(feature, layer) => {
                const name = (feature.properties?.DPTO_CNMBR as string) ?? "";
                const html = tooltipHtml(name);
                layer.bindTooltip(html, { sticky: true, direction: "top" });
                layer.bindPopup(html);
              }}
            />
          </MapContainer>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-anh-muted">
        {LEGEND.map((l) => (
          <span key={l.text} className="flex items-center gap-1">
            <i
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: colorFor(l.at) }}
              aria-hidden
            />
            {l.text}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: NEUTRAL }} aria-hidden />
          {labels.noSample}
        </span>
      </div>
    </div>
  );
}
