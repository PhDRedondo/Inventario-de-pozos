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

/** Escala secuencial (teal) por número de pozos en el municipio. */
function choroplethColor(total: number): string {
  if (total >= 3) return '#0b525b';
  if (total === 2) return '#1a7f8e';
  return '#7fc3cc';
}

/**
 * Mapa territorial (Leaflet): coropleto municipal (GeoJSON DANE) sombreado por
 * número de pozos, contorno de departamentos como contexto y un punto por pozo
 * aplicado coloreado por su estado de validación.
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
  private map?: L.Map;

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

  /** Contorno de departamentos como contexto (sin relleno). */
  private addDepartments(geo: GeoJSON.FeatureCollection): void {
    if (!this.map) return;
    L.geoJSON(geo, {
      style: () => ({ color: '#1e3a4a', weight: 1, fill: false, opacity: 0.35 }),
    }).addTo(this.map);
  }

  /** Coropleto municipal: solo los municipios con pozos, sombreados por conteo. */
  private addMunicipios(geo: GeoJSON.FeatureCollection, counts: MunicipioCount[]): void {
    if (!this.map) return;
    const byDane = new Map(counts.map((c) => [c.codigoDane, c]));
    this.municipioCount = counts.length;

    const withWells = {
      ...geo,
      features: geo.features.filter((f) => byDane.has(String(f.properties?.['MPIO_CCNCT']))),
    } as GeoJSON.FeatureCollection;

    L.geoJSON(withWells, {
      style: (feature) => {
        const c = byDane.get(String(feature?.properties?.['MPIO_CCNCT']));
        return {
          color: '#0b525b',
          weight: 1,
          fillColor: choroplethColor(c?.total ?? 0),
          fillOpacity: 0.55,
        };
      },
      onEachFeature: (feature, layer) => {
        const c = byDane.get(String(feature.properties?.['MPIO_CCNCT']));
        if (!c) return;
        layer.bindPopup(
          `<strong>${c.municipio ?? feature.properties?.['MPIO_CNMBR']}</strong> ` +
          `<small>(${c.codigoDane})</small><br/>${c.departamento ?? '—'}<br/>` +
          `Pozos: <strong>${c.total}</strong><br/>` +
          `Válidos ${c.valid} · Advertencia ${c.warning} · Inválidos ${c.invalid}`,
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
