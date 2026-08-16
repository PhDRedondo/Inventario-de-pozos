import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateNotebookRequest,
  DashboardStats,
  NotebookCreated,
  SubmitResponse,
  UploadResult,
  ValidationResult,
} from '../models/notebook.models';

/** Cliente tipado de la Web API .NET (Anh.Vip.Api). */
@Injectable({ providedIn: 'root' })
export class VipApiService {
  private readonly base = environment.apiBase;

  constructor(private readonly http: HttpClient) {}

  createNotebook(req: CreateNotebookRequest): Observable<NotebookCreated> {
    return this.http.post<NotebookCreated>(`${this.base}/api/notebooks`, req);
  }

  uploadVersion(notebookId: number, file: File): Observable<UploadResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<UploadResult>(`${this.base}/api/notebooks/${notebookId}/upload`, form);
  }

  submit(notebookId: number): Observable<SubmitResponse> {
    return this.http.post<SubmitResponse>(`${this.base}/api/notebooks/${notebookId}/submit`, {});
  }

  getValidations(uploadId: number): Observable<ValidationResult[]> {
    return this.http.get<ValidationResult[]>(`${this.base}/api/validations`, {
      params: { uploadId: String(uploadId) },
    });
  }

  getStats(limit?: number): Observable<DashboardStats> {
    const params: Record<string, string> = {};
    if (limit) params['limit'] = String(limit);
    return this.http.get<DashboardStats>(`${this.base}/api/stats`, { params });
  }

  /** URL de descarga de la plantilla (enlace directo, no XHR). */
  templateUrl(rows: number, operadora?: string): string {
    const params = new URLSearchParams({ rows: String(rows) });
    if (operadora) params.set('operadora', operadora);
    return `${this.base}/api/notebooks/template?${params.toString()}`;
  }
}
