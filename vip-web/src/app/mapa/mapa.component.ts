import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { forkJoin } from 'rxjs';
import { VipApiService } from '../services/vip-api.service';
import { WellMapPoint } from '../models/notebook.models';

const STATUS_COLOR: Record<string, string> = {
  valid: '#1b7f4a',
  warning: '#ff8c00',
  invalid: '#b42318',
  pending: '#5a6b7d',
};

/**
 * Mapa territorial (Leaflet): polígonos de departamentos (GeoJSON) y un punto
 * por pozo aplicado, coloreado por su estado de validación.
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
  private map?: L.Map;

  constructor(private readonly api: VipApiService, private readonly http: HttpClient) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement).setView([4.6, -73.8], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 12,
    }).addTo(this.map);

    forkJoin({
      geo: this.http.get<GeoJSON.FeatureCollection>('/geo/colombia-departamentos.geojson'),
      wells: this.api.getWellsMap(),
    }).subscribe({
      next: ({ geo, wells }) => {
        this.addDepartments(geo);
        this.addWells(wells);
      },
      error: () => (this.error = 'No fue posible cargar el mapa.'),
    });
  }

  private addDepartments(geo: GeoJSON.FeatureCollection): void {
    if (!this.map) return;
    L.geoJSON(geo, {
      style: () => ({ color: '#1e3a4a', weight: 1, fillColor: '#1e3a4a', fillOpacity: 0.04 }),
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
