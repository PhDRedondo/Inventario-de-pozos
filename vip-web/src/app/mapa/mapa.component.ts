import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { VipApiService } from '../services/vip-api.service';
import { KeyCount } from '../models/notebook.models';

/** Centroides aproximados de departamentos (clave normalizada sin tildes). */
const CENTROIDS: Record<string, [number, number]> = {
  META: [3.35, -73.05],
  CASANARE: [5.35, -71.6],
  ARAUCA: [6.55, -71.0],
  ANTIOQUIA: [6.6, -75.6],
  SANTANDER: [6.6, -73.1],
  BOYACA: [5.6, -73.0],
  CUNDINAMARCA: [4.8, -74.3],
  HUILA: [2.55, -75.5],
  TOLIMA: [4.1, -75.2],
  BOLIVAR: [8.6, -74.5],
  CESAR: [9.5, -73.5],
  MAGDALENA: [10.4, -74.4],
  'LA GUAJIRA': [11.4, -72.5],
  'NORTE DE SANTANDER': [8.1, -72.9],
  PUTUMAYO: [0.4, -76.6],
  CAQUETA: [0.9, -74.9],
  NARINO: [1.3, -77.6],
  'VALLE DEL CAUCA': [3.8, -76.5],
  CORDOBA: [8.3, -75.6],
  SUCRE: [9.0, -75.0],
  ATLANTICO: [10.7, -74.9],
  CAUCA: [2.4, -76.8],
};

function normalize(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

/** Mapa territorial: pozos aplicados agregados por departamento (Leaflet). */
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
  unmapped: KeyCount[] = [];
  private map?: L.Map;

  constructor(private readonly api: VipApiService) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, { attributionControl: true }).setView([4.6, -73.8], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 12,
    }).addTo(this.map);

    this.api.getStats().subscribe({
      next: (s) => this.plot(s.byDepartamento),
      error: () => (this.error = 'No fue posible cargar el mapa.'),
    });
  }

  private plot(byDepartamento: KeyCount[]): void {
    if (!this.map || byDepartamento.length === 0) return;
    const max = Math.max(...byDepartamento.map((d) => d.value), 1);

    for (const d of byDepartamento) {
      const centroid = CENTROIDS[normalize(d.key)];
      if (!centroid) {
        this.unmapped.push(d);
        continue;
      }
      const radius = 8 + (d.value / max) * 22;
      L.circleMarker(centroid, {
        radius,
        color: '#ff8c00',
        weight: 1.5,
        fillColor: '#ff8c00',
        fillOpacity: 0.5,
      })
        .bindPopup(`<strong>${d.key}</strong><br/>${d.value} pozo(s)`)
        .addTo(this.map);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
