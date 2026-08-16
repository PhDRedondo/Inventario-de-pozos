import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VipApiService } from '../services/vip-api.service';
import { NotebookSummary } from '../models/notebook.models';

/** Inventario de cuadernos: crear un cuaderno o abrir uno existente. */
@Component({
  selector: 'app-notebooks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notebooks.component.html',
  styleUrl: './notebooks.component.css',
})
export class NotebooksComponent implements OnInit {
  operadora = 'HOCOL S.A.';
  title = '';
  wellCount = 10;

  notebooks: NotebookSummary[] = [];
  loading = true;
  creating = false;
  error: string | null = null;

  constructor(private readonly api: VipApiService, private readonly router: Router) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.api.listNotebooks().subscribe({
      next: (r) => {
        this.notebooks = r.notebooks;
        this.loading = false;
      },
      error: () => {
        this.error = 'No fue posible cargar los cuadernos.';
        this.loading = false;
      },
    });
  }

  get safeRows(): number {
    return Math.min(500, Math.max(1, Math.floor(this.wellCount) || 1));
  }

  templateHref(): string {
    return this.api.templateUrl(this.safeRows, this.operadora);
  }

  create(): void {
    if (!this.operadora.trim()) {
      this.error = 'Indique la operadora.';
      return;
    }
    this.creating = true;
    this.error = null;
    this.api.createNotebook({ operadora: this.operadora.trim(), title: this.title.trim() }).subscribe({
      next: (n) => this.router.navigate(['/cuadernos', n.id]),
      error: (e) => {
        this.error = (e?.error?.error as string) ?? 'No fue posible crear el cuaderno.';
        this.creating = false;
      },
    });
  }

  open(id: number): void {
    this.router.navigate(['/cuadernos', id]);
  }
}
