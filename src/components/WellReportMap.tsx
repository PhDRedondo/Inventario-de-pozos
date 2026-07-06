"use client";

import { ESRI_WORLD_IMAGERY, SATELLITE_MAP_ZOOM } from "@/lib/satellite-map";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function markerColor(status: string | null | undefined): string {
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

interface WellReportMapProps {
  lat: number;
  lng: number;
  validationStatus?: string | null;
  className?: string;
}

export default function WellReportMap({ lat, lng, validationStatus, className = "h-52 w-full" }: WellReportMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={SATELLITE_MAP_ZOOM}
      minZoom={5}
      maxZoom={16}
      className={`${className} rounded-xl border border-anh-border`}
      scrollWheelZoom={false}
      dragging
    >
      <TileLayer attribution={ESRI_WORLD_IMAGERY.attribution} url={ESRI_WORLD_IMAGERY.tileUrl} />
      <CircleMarker
        center={[lat, lng]}
        radius={10}
        pathOptions={{
          color: "#ffffff",
          fillColor: markerColor(validationStatus),
          fillOpacity: 0.95,
          weight: 2.5,
        }}
      />
    </MapContainer>
  );
}
