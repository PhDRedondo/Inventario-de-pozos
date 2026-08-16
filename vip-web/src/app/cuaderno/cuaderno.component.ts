import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VipApiService } from '../services/vip-api.service';
import { UploadResult, ValidationResult } from '../models/notebook.models';

type FindingFilter = 'all' | 'errors' | 'warnings';

interface FindingRow {
  well: string;
  field: string;
  severity: string;
  message: string;
}

/**
 * Espacio de trabajo del cuaderno (perfil operadora): crear cuaderno, descargar
 * la plantilla, cargar el Excel, revisar hallazgos y aplicar a la ANH. Consume
 * la Web API .NET vía {@link VipApiService}.
 */
@Component({
  selector: 'app-cuaderno',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cuaderno.component.html',
  styleUrl: './cuaderno.component.css',
})
export class CuadernoComponent {
  operadora = 'HOCOL S.A.';
  title = '';
  wellCount = 10;

  notebookId: number | null = null;
  upload: UploadResult | null = null;
  validations: ValidationResult[] = [];
  filter: FindingFilter = 'all';

  creating = false;
  uploading = false;
  submitting = false;
  error: string | null = null;
  message: string | null = null;

  constructor(private readonly api: VipApiService) {}

  get canSubmit(): boolean {
    return !!this.upload && this.upload.summary.invalid === 0 && this.upload.summary.total > 0;
  }

  get safeRows(): number {
    return Math.min(500, Math.max(1, Math.floor(this.wellCount) || 1));
  }

  templateHref(): string {
    return this.api.templateUrl(this.safeRows, this.operadora);
  }

  createNotebook(): void {
    if (!this.operadora.trim()) {
      this.error = 'Indique la operadora.';
      return;
    }
    this.creating = true;
    this.error = null;
    this.message = null;
    this.api.createNotebook({ operadora: this.operadora.trim(), title: this.title.trim() }).subscribe({
      next: (n) => {
        this.notebookId = n.id;
        this.upload = null;
        this.validations = [];
        this.message = `Cuaderno #${n.id} creado para ${n.operadora}.`;
        this.creating = false;
      },
      error: (e) => {
        this.error = this.readError(e, 'No fue posible crear el cuaderno.');
        this.creating = false;
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.notebookId == null) return;

    this.uploading = true;
    this.error = null;
    this.message = null;
    this.api.uploadVersion(this.notebookId, file).subscribe({
      next: (res) => {
        this.upload = res;
        this.message = `Versión ${res.version_number} cargada: ${res.summary.total} pozos (${res.summary.invalid} inválidos).`;
        this.uploading = false;
        this.loadValidations(res.upload_id);
        input.value = '';
      },
      error: (e) => {
        this.error = this.readError(e, 'No fue posible procesar el archivo.');
        this.uploading = false;
        input.value = '';
      },
    });
  }

  loadValidations(uploadId: number): void {
    this.api.getValidations(uploadId).subscribe({
      next: (rows) => (this.validations = rows),
      error: () => (this.validations = []),
    });
  }

  submit(): void {
    if (this.notebookId == null || !this.canSubmit) return;
    this.submitting = true;
    this.error = null;
    this.api.submit(this.notebookId).subscribe({
      next: (res) => {
        this.message = res.message;
        this.submitting = false;
      },
      error: (e) => {
        this.error = this.readError(e, 'No fue posible aplicar el inventario.');
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

  private readError(e: unknown, fallback: string): string {
    const err = e as { error?: { error?: string } };
    return err?.error?.error ?? fallback;
  }
}
