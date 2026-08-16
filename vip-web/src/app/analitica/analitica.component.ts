import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VipApiService } from '../services/vip-api.service';
import { AnalyticsResult } from '../models/notebook.models';

interface RadarAxis {
  lineX: number;
  lineY: number;
  labelX: number;
  labelY: number;
  label: string;
  anchor: string;
}

/**
 * Analítica comparativa (perfil ANH): compara una operadora o departamento
 * frente al promedio nacional (base 100) con un radar SVG y barras de delta.
 */
@Component({
  selector: 'app-analitica',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analitica.component.html',
  styleUrl: './analitica.component.css',
})
export class AnaliticaComponent implements OnInit {
  readonly cx = 160;
  readonly cy = 160;
  readonly r = 120;
  readonly maxIndex = 200; // el anillo base 100 queda a media escala

  theme: 'perfil' | 'produccion' | 'inyeccion' = 'perfil';
  entityType: 'operadora' | 'departamento' = 'operadora';
  entity = '';
  result: AnalyticsResult | null = null;
  loading = true;
  error: string | null = null;

  constructor(private readonly api: VipApiService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.api.getAnalytics(this.theme, this.entity ? this.entityType : undefined, this.entity || undefined).subscribe({
      next: (r) => {
        this.result = r;
        this.loading = false;
      },
      error: () => {
        this.error = 'No fue posible cargar la analítica.';
        this.loading = false;
      },
    });
  }

  get entityOptions(): string[] {
    if (!this.result) return [];
    return this.entityType === 'operadora' ? this.result.operadoras : this.result.departamentos;
  }

  onTypeChange(): void {
    this.entity = '';
    this.load();
  }

  /** Sufijo de unidad: porcentaje en el tema perfil, sin sufijo en los numéricos. */
  get unit(): string {
    return this.theme === 'perfil' ? '%' : '';
  }

  // ---- Geometría del radar -------------------------------------------------

  private angle(i: number, n: number): number {
    return (-90 + (i * 360) / n) * (Math.PI / 180);
  }

  private point(i: number, n: number, value: number): [number, number] {
    const rad = (Math.min(value, this.maxIndex) / this.maxIndex) * this.r;
    const a = this.angle(i, n);
    return [this.cx + rad * Math.cos(a), this.cy + rad * Math.sin(a)];
  }

  get rings(): number[] {
    return [50, 100, 150, 200].map((v) => (v / this.maxIndex) * this.r);
  }

  get axes(): RadarAxis[] {
    const m = this.result?.metrics ?? [];
    return m.map((metric, i) => {
      const a = this.angle(i, m.length);
      const [lx, ly] = [this.cx + this.r * Math.cos(a), this.cy + this.r * Math.sin(a)];
      const labelR = this.r + 14;
      const labelX = this.cx + labelR * Math.cos(a);
      const labelY = this.cy + labelR * Math.sin(a);
      const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      return { lineX: lx, lineY: ly, labelX, labelY, label: metric.label, anchor };
    });
  }

  private polygon(values: number[]): string {
    return values.map((v, i) => this.point(i, values.length, v).join(',')).join(' ');
  }

  get nationalPolygon(): string {
    const m = this.result?.metrics ?? [];
    return this.polygon(m.map(() => 100)); // base nacional = 100 en cada eje
  }

  get entityPolygon(): string {
    const m = this.result?.metrics ?? [];
    return this.polygon(m.map((x) => x.index));
  }
}
