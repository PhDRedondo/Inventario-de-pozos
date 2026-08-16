import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { VipApiService } from '../services/vip-api.service';
import { DashboardStats, KeyCount } from '../models/notebook.models';

/** Panel institucional: KPIs y desgloses del inventario aplicado (GET /api/stats). */
@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './panel.component.html',
  styleUrl: './panel.component.css',
})
export class PanelComponent implements OnInit {
  stats: DashboardStats | null = null;
  loading = true;
  error: string | null = null;

  constructor(private readonly api: VipApiService) {}

  ngOnInit(): void {
    this.api.getStats(25).subscribe({
      next: (s) => {
        this.stats = s;
        this.loading = false;
      },
      error: () => {
        this.error = 'No fue posible cargar el panel.';
        this.loading = false;
      },
    });
  }

  /** Ancho relativo (%) de una barra respecto al máximo del grupo. */
  barWidth(item: KeyCount, group: KeyCount[]): number {
    const max = Math.max(1, ...group.map((g) => g.value));
    return Math.round((item.value / max) * 100);
  }
}
