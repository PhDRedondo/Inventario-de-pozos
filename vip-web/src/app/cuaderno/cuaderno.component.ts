import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VipApiService } from '../services/vip-api.service';
import { NotebookDetail, ValidationResult } from '../models/notebook.models';

type FindingFilter = 'all' | 'errors' | 'warnings';

interface FindingRow {
  well: string;
  field: string;
  severity: string;
  message: string;
}

interface Summary {
  total: number;
  valid: number;
  withWarnings: number;
  invalid: number;
}

/**
 * Workspace de un cuaderno existente (perfil operadora): carga sus versiones,
 * descarga la plantilla, carga el Excel, revisa hallazgos y aplica a la ANH.
 */
@Component({
  selector: 'app-cuaderno',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cuaderno.component.html',
  styleUrl: './cuaderno.component.css',
})
export class CuadernoComponent implements OnInit {
  notebookId = 0;
  detail: NotebookDetail | null = null;
  summary: Summary | null = null;
  validations: ValidationResult[] = [];
  filter: FindingFilter = 'all';
  wellCount = 10;

  loading = true;
  uploading = false;
  submitting = false;
  error: string | null = null;
  message: string | null = null;

  constructor(private readonly api: VipApiService, private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.notebookId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadDetail();
  }

  private loadDetail(): void {
    this.loading = true;
    this.api.getNotebook(this.notebookId).subscribe({
      next: (d) => {
        this.detail = d;
        this.loading = false;
        const active = d.versions.find((v) => v.id === d.notebook.activeVersionId);
        if (active) {
          this.summary = {
            total: active.totalRecords,
            valid: active.validRecords,
            withWarnings: active.warningRecords,
            invalid: active.invalidRecords,
          };
          this.loadValidations(active.id);
        } else {
          this.summary = null;
          this.validations = [];
        }
      },
      error: () => {
        this.error = 'No fue posible cargar el cuaderno.';
        this.loading = false;
      },
    });
  }

  get operadora(): string {
    return this.detail?.notebook.operadora ?? '';
  }

  get isActive(): boolean {
    return this.detail?.notebook.status === 'active';
  }

  get canSubmit(): boolean {
    return this.isActive && !!this.summary && this.summary.invalid === 0 && this.summary.total > 0;
  }

  get safeRows(): number {
    return Math.min(500, Math.max(1, Math.floor(this.wellCount) || 1));
  }

  templateHref(): string {
    return this.api.templateUrl(this.safeRows, this.operadora);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading = true;
    this.error = null;
    this.message = null;
    this.api.uploadVersion(this.notebookId, file).subscribe({
      next: (res) => {
        this.summary = res.summary;
        this.message = `Versión ${res.version_number} cargada: ${res.summary.total} pozos (${res.summary.invalid} inválidos).`;
        this.uploading = false;
        input.value = '';
        this.loadValidations(res.upload_id);
        this.refreshVersions();
      },
      error: (e) => {
        this.error = (e?.error?.error as string) ?? 'No fue posible procesar el archivo.';
        this.uploading = false;
        input.value = '';
      },
    });
  }

  private refreshVersions(): void {
    this.api.getNotebook(this.notebookId).subscribe({ next: (d) => (this.detail = d) });
  }

  private loadValidations(uploadId: number): void {
    this.api.getValidations(uploadId).subscribe({
      next: (rows) => (this.validations = rows),
      error: () => (this.validations = []),
    });
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    this.error = null;
    this.api.submit(this.notebookId).subscribe({
      next: (res) => {
        this.message = res.message;
        this.submitting = false;
        this.loadDetail();
      },
      error: (e) => {
        this.error = (e?.error?.error as string) ?? 'No fue posible aplicar el inventario.';
        this.submitting = false;
      },
    });
  }

  get findingRows(): FindingRow[] {
    const rows: FindingRow[] = [];
    for (const well of this.validations) {
      for (const issue of well.issues) {
        if (this.filter === 'errors' && issue.severity !== 'error') continue;
        if (this.filter === 'warnings' && issue.severity === 'error') continue;
        rows.push({
          well: well.nombre_pozo_sgc ?? `#${well.well_id}`,
          field: issue.field,
          severity: issue.severity,
          message: issue.message,
        });
      }
    }
    return rows;
  }
}
