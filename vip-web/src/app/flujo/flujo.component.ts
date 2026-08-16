import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { VipApiService } from '../services/vip-api.service';
import { SankeyData } from '../models/notebook.models';

interface LaidNode {
  id: string;
  label: string;
  col: number;
  value: number;
  x: number;
  y: number;
  h: number;
  outOffset: number;
  inOffset: number;
}
interface LaidLink {
  path: string;
  value: number;
}

/** Diagrama Sankey: flujo Departamento → Estado → Operadora del inventario aplicado. */
@Component({
  selector: 'app-flujo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flujo.component.html',
  styleUrl: './flujo.component.css',
})
export class FlujoComponent implements OnInit {
  readonly width = 720;
  readonly height = 420;
  readonly nodeW = 14;
  readonly gap = 6;

  loading = true;
  error: string | null = null;
  nodes: LaidNode[] = [];
  links: LaidLink[] = [];

  constructor(private readonly api: VipApiService) {}

  ngOnInit(): void {
    this.api.getSankey().subscribe({
      next: (d) => {
        this.layout(d);
        this.loading = false;
      },
      error: () => {
        this.error = 'No fue posible cargar el flujo.';
        this.loading = false;
      },
    });
  }

  private colX(col: number): number {
    if (col === 0) return 8;
    if (col === 1) return this.width / 2 - this.nodeW / 2;
    return this.width - 8 - this.nodeW;
  }

  private layout(data: SankeyData): void {
    const nodeMap = new Map<string, LaidNode>();

    for (let col = 0; col <= 2; col++) {
      const colNodes = data.nodes.filter((n) => n.col === col).sort((a, b) => b.value - a.value);
      const total = colNodes.reduce((s, n) => s + n.value, 0) || 1;
      const usable = this.height - (colNodes.length - 1) * this.gap;
      let y = 0;
      for (const n of colNodes) {
        const h = Math.max(4, (n.value / total) * usable);
        const node: LaidNode = { ...n, x: this.colX(col), y, h, outOffset: 0, inOffset: 0 };
        nodeMap.set(n.id, node);
        y += h + this.gap;
      }
    }

    this.nodes = [...nodeMap.values()];

    // Enlaces col0→col1 primero, luego col1→col2, ordenados para apilar prolijo.
    const ordered = [...data.links].sort((a, b) => {
      const sa = nodeMap.get(a.source)!;
      const sb = nodeMap.get(b.source)!;
      return sa.col - sb.col || sa.y - sb.y;
    });

    this.links = ordered
      .map((l) => {
        const s = nodeMap.get(l.source);
        const t = nodeMap.get(l.target);
        if (!s || !t) return null;
        const sh = (l.value / s.value) * s.h;
        const th = (l.value / t.value) * t.h;
        const sy0 = s.y + s.outOffset;
        const ty0 = t.y + t.inOffset;
        s.outOffset += sh;
        t.inOffset += th;
        const sx = s.x + this.nodeW;
        const tx = t.x;
        const mx = (sx + tx) / 2;
        const path =
          `M ${sx} ${sy0} C ${mx} ${sy0}, ${mx} ${ty0}, ${tx} ${ty0}` +
          ` L ${tx} ${ty0 + th} C ${mx} ${ty0 + th}, ${mx} ${sy0 + sh}, ${sx} ${sy0 + sh} Z`;
        return { path, value: l.value };
      })
      .filter((x): x is LaidLink => x !== null);
  }

  nodeClass(col: number): string {
    return col === 0 ? 'dept' : col === 1 ? 'estado' : 'operadora';
  }

  labelX(n: LaidNode): number {
    return n.col === 2 ? n.x - 6 : n.x + this.nodeW + 6;
  }

  labelAnchor(n: LaidNode): string {
    return n.col === 2 ? 'end' : 'start';
  }
}
