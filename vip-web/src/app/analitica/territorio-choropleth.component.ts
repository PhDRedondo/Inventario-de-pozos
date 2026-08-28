import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { forkJoin } from 'rxjs';
import { VipApiService } from '../services/vip-api.service';
import { TerritorioDept, TerritorioMetric } from '../models/notebook.models';

/** Escala relativa al promedio nacional (100%), igual que el piloto. */
function heatColor(ratio: number): string {
  if (ratio >= 130) return '#e8381a';
  if (ratio >= 110) return '#ff8c00';
  if (ratio >= 90) return '#ffe600';
  if (ratio >= 70) return '#38bdf8';
  return '#6366f1';
}
const NEUTRAL = '#e5e7eb';

/** Normaliza un nombre de departamento (mayúsculas, sin tildes) para el match con el GeoJSON. */
function norm(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Coropleto de los departamentos de Colombia coloreados por un indicador de
 * perfil operativo frente al promedio nacional (100%). Consume
 * `GET /api/analytics/by-departamento`.
 */
@Component({
  selector: 'app-territorio-choropleth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <label class="metric">
      {{ 'Indicador' }}
      <select [(ngModel)]="selectedMetric" (ngModelChange)="restyle()">
        <option *ngFor="let m of metrics" [value]="m.key">{{ m.label }}</option>
      </select>
    </label>

    <div class="alert error" *ngIf="error">{{ error }}</div>
    <div #map class="map"></div>

    <div class="legend">
      <span><i class="sw" style="background:#6366f1"></i> &lt;70%</span>
      <span><i class="sw" style="background:#38bdf8"></i> 70–90%</span>
      <span><i class="sw" style="background:#ffe600"></i> 90–110%</span>
      <span><i class="sw" style="background:#ff8c00"></i> 110–130%</span>
      <span><i class="sw" style="background:#e8381a"></i> ≥130%</span>
      <span><i class="sw" style="background:#e5e7eb"></i> Sin muestra</span>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .metric { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; font-weight: 700; color: #5a6b7d; margin-bottom: 0.6rem; }
    .metric select { border: 1px solid #c3d0dc; border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.8rem; font-weight: 400; color: #1e3a4a; }
    .map { height: 420px; width: 100%; border: 1px solid #d8e2ec; border-radius: 10px; overflow: hidden; z-index: 0; }
    .alert.error { background: #fdecea; color: #b42318; border: 1px solid #f3c2bd; border-radius: 8px; padding: 0.6rem 0.8rem; margin-bottom: 0.5rem; }
    .legend { display: flex; flex-wrap: wrap; gap: 0.8rem; font-size: 0.72rem; color: #5a6b7d; margin-top: 0.5rem; }
    .legend .sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 0.3rem; vertical-align: middle; }
  `],
})
export class TerritorioChoroplethComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  metrics: TerritorioMetric[] = [];
  selectedMetric = 'pct_activo';
  error: string | null = null;

  private map?: L.Map;
  private layer?: L.GeoJSON;
  private byName = new Map<string, TerritorioDept>();

  constructor(private readonly api: VipApiService, private readonly http: HttpClient) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement).setView([4.6, -73.8], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 12,
    }).addTo(this.map);

    forkJoin({
      geo: this.http.get<GeoJSON.FeatureCollection>('/geo/colombia-departamentos.geojson'),
      data: this.api.getTerritorio(),
    }).subscribe({
      next: ({ geo, data }) => {
        this.metrics = data.metrics;
        if (!this.metrics.some((m) => m.key === this.selectedMetric)) {
          this.selectedMetric = this.metrics[0]?.key ?? 'pct_activo';
        }
        this.byName = new Map(data.departamentos.map((d) => [norm(d.name), d]));
        this.draw(geo);
      },
      error: () => (this.error = 'No fue posible cargar el mapa territorial.'),
    });
  }

  private nationalFor(key: string): number {
    return this.metrics.find((m) => m.key === key)?.national ?? 0;
  }

  private ratioFor(name: string): number | null {
    const dep = this.byName.get(norm(name));
    if (!dep) return null;
    const raw = dep.values[this.selectedMetric] ?? 0;
    const nat = this.nationalFor(this.selectedMetric);
    return nat > 0 ? (raw / nat) * 100 : raw > 0 ? 100 : 0;
  }

  private styleFor = (feature?: GeoJSON.Feature): L.PathOptions => {
    const name = String(feature?.properties?.['DPTO_CNMBR'] ?? '');
    const ratio = this.ratioFor(name);
    return ratio === null
      ? { color: '#cbd5e1', weight: 1, fillColor: NEUTRAL, fillOpacity: 0.25 }
      : { color: '#1e3a4a', weight: 1, fillColor: heatColor(ratio), fillOpacity: 0.7 };
  };

  private tooltipHtml(name: string): string {
    const dep = this.byName.get(norm(name));
    const metric = this.metrics.find((m) => m.key === this.selectedMetric);
    if (!dep || !metric) return `<strong>${name}</strong><br/><small>Sin pozos en la muestra</small>`;
    const raw = dep.values[this.selectedMetric] ?? 0;
    const ratio = this.ratioFor(name) ?? 0;
    return (
      `<strong>${name}</strong><br/>${metric.label}: <strong>${raw.toLocaleString('es-CO')}</strong><br/>` +
      `${ratio.toFixed(0)}% vs promedio nacional<br/><small>${dep.sampleSize} pozo(s) en la muestra</small>`
    );
  }

  private draw(geo: GeoJSON.FeatureCollection): void {
    if (!this.map) return;
    this.layer = L.geoJSON(geo, {
      style: (f) => this.styleFor(f),
      onEachFeature: (feature, lyr) => {
        const name = String(feature.properties?.['DPTO_CNMBR'] ?? '');
        lyr.bindTooltip(() => this.tooltipHtml(name), { sticky: true, direction: 'top' });
      },
    }).addTo(this.map);
  }

  /** Recolorea al cambiar el indicador (los tooltips leen el indicador actual al abrirse). */
  restyle(): void {
    this.layer?.setStyle((f) => this.styleFor(f));
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
