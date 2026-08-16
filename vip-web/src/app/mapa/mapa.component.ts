import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { forkJoin } from 'rxjs';
import { VipApiService } from '../services/vip-api.service';
import { MunicipioCount, WellMapPoint } from '../models/notebook.models';

const STATUS_COLOR: Record<string, string> = {
  valid: '#1b7f4a',
  warning: '#ff8c00',
  invalid: '#b42318',
  pending: '#5a6b7d',
};

export type MapMode = 'pozos' | 'produccion';

/** Escala secuencial (teal) por número de pozos en el municipio. */
function countColor(total: number): string {
  if (total >= 3) return '#0b525b';
  if (total === 2) return '#1a7f8e';
  return '#7fc3cc';
}

/** Escala secuencial (ámbar) por barriles de petróleo acumulados en el municipio. */
function oilColor(bbl: number): string {
  if (bbl >= 20000) return '#b5650a';
  if (bbl >= 10000) return '#f0a733';
  if (bbl > 0) return '#fbdd9a';
  return '#d8cfc2'; // sin producción de petróleo (p. ej. municipios de inyección)
}

/** Formatea un valor de producción con separador de miles (es-CO), sin decimales. */
function fmt(n: number): string {
  return Math.round(n).toLocaleString('es-CO');
}

/**
 * Mapa territorial (Leaflet): coropleto municipal (GeoJSON DANE) sombreable por
 * número de pozos o por producción de petróleo, contorno de departamentos como
 * contexto y un punto por pozo aplicado coloreado por su estado de validación.
 */
@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mapa.component.html',
  styleUrl: './mapa.component.css',
})
export class MapaComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  error: string | null = null;
  count = 0;
  municipioCount = 0;
  mode: MapMode = 'pozos';

  private map?: L.Map;
  private muniLayer?: L.GeoJSON;
  private byDane = new Map<string, MunicipioCount>();

  constructor(private readonly api: VipApiService, private readonly http: HttpClient) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement).setView([4.6, -73.8], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 12,
    }).addTo(this.map);

    forkJoin({
      deptos: this.http.get<GeoJSON.FeatureCollection>('/geo/colombia-departamentos.geojson'),
      munis: this.http.get<GeoJSON.FeatureCollection>('/geo/colombia-municipios.geojson'),
      counts: this.api.getMunicipioCounts(),
      wells: this.api.getWellsMap(),
    }).subscribe({
      next: ({ deptos, munis, counts, wells }) => {
        this.addDepartments(deptos);
        this.addMunicipios(munis, counts);
        this.addWells(wells);
      },
      error: () => (this.error = 'No fue posible cargar el mapa.'),
    });
  }

  /** Alterna el criterio del coropleto y re-sombrea la capa municipal. */
  setMode(mode: MapMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.muniLayer?.setStyle((feature) => this.muniStyle(feature));
  }

  /** Relleno del municipio según el modo activo (pozos | producción). */
  private muniStyle(feature?: GeoJSON.Feature): L.PathOptions {
    const c = this.byDane.get(String(feature?.properties?.['MPIO_CCNCT']));
    const fillColor = this.mode === 'produccion' ? oilColor(c?.prodPetroleo ?? 0) : countColor(c?.total ?? 0);
    return { color: '#4a3b26', weight: 1, fillColor, fillOpacity: 0.6 };
  }

  /** Contorno de departamentos como contexto (sin relleno). */
  private addDepartments(geo: GeoJSON.FeatureCollection): void {
    if (!this.map) return;
    L.geoJSON(geo, {
      style: () => ({ color: '#1e3a4a', weight: 1, fill: false, opacity: 0.35 }),
    }).addTo(this.map);
  }

  /** Coropleto municipal: solo los municipios con pozos. */
  private addMunicipios(geo: GeoJSON.FeatureCollection, counts: MunicipioCount[]): void {
    if (!this.map) return;
    this.byDane = new Map(counts.map((c) => [c.codigoDane, c]));
    this.municipioCount = counts.length;

    const withWells = {
      ...geo,
      features: geo.features.filter((f) => this.byDane.has(String(f.properties?.['MPIO_CCNCT']))),
    } as GeoJSON.FeatureCollection;

    this.muniLayer = L.geoJSON(withWells, {
      style: (feature) => this.muniStyle(feature),
      onEachFeature: (feature, layer) => {
        const c = this.byDane.get(String(feature.properties?.['MPIO_CCNCT']));
        if (!c) return;
        const nombre = c.municipio ?? feature.properties?.['MPIO_CNMBR'];

        // Tooltip (hover): resumen de producción acumulada del municipio.
        layer.bindTooltip(
          `<strong>${nombre}</strong><br/>` +
          `${c.total} pozo(s)<br/>` +
          `Petróleo ${fmt(c.prodPetroleo)} BBL<br/>` +
          `Gas ${fmt(c.prodGas)} KPC · Agua ${fmt(c.prodAgua)} BBL`,
          { sticky: true, direction: 'top', className: 'muni-tooltip' },
        );

        // Popup (clic): validación + producción detallada.
        layer.bindPopup(
          `<strong>${nombre}</strong> <small>(${c.codigoDane})</small><br/>${c.departamento ?? '—'}<br/>` +
          `Pozos: <strong>${c.total}</strong><br/>` +
          `Válidos ${c.valid} · Advertencia ${c.warning} · Inválidos ${c.invalid}<br/>` +
          `<hr style="margin:4px 0;border:0;border-top:1px solid #d8e2ec"/>` +
          `Petróleo <strong>${fmt(c.prodPetroleo)}</strong> BBL<br/>` +
          `Gas <strong>${fmt(c.prodGas)}</strong> KPC<br/>` +
          `Agua <strong>${fmt(c.prodAgua)}</strong> BBL`,
        );
      },
    }).addTo(this.map);
  }

  private addWells(wells: WellMapPoint[]): void {
    if (!this.map) return;
    this.count = wells.length;
    const group = L.featureGroup();
    for (const w of wells) {
      const color = STATUS_COLOR[w.validationStatus ?? 'pending'] ?? '#5a6b7d';
      L.circleMarker([w.lat, w.lng], { radius: 6, color, weight: 1.5, fillColor: color, fillOpacity: 0.65 })
        .bindPopup(
          `<strong>${w.nombre ?? '—'}</strong><br/>${w.operadora ?? '—'}<br/>` +
          `${w.departamento ?? '—'} · ${w.estado ?? '—'}<br/>Validación: ${w.validationStatus ?? '—'}`,
        )
        .addTo(group);
    }
    group.addTo(this.map);
    if (wells.length > 0) this.map.fitBounds(group.getBounds().pad(0.3));
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
