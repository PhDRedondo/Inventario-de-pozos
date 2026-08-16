import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AnalyticsResult,
  CreateNotebookRequest,
  DashboardStats,
  NotebookCreated,
  NotebookDetail,
  NotebookSummary,
  SankeyData,
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

  listNotebooks(operadora?: string): Observable<{ notebooks: NotebookSummary[] }> {
    const params: Record<string, string> = {};
    if (operadora) params['operadora'] = operadora;
    return this.http.get<{ notebooks: NotebookSummary[] }>(`${this.base}/api/notebooks`, { params });
  }

  getNotebook(id: number): Observable<NotebookDetail> {
    return this.http.get<NotebookDetail>(`${this.base}/api/notebooks/${id}`);
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

  getAnalytics(entityType?: string, entity?: string): Observable<AnalyticsResult> {
    const params: Record<string, string> = {};
    if (entityType && entity) {
      params['entityType'] = entityType;
      params['entity'] = entity;
    }
    return this.http.get<AnalyticsResult>(`${this.base}/api/analytics`, { params });
  }

  getSankey(): Observable<SankeyData> {
    return this.http.get<SankeyData>(`${this.base}/api/analytics/sankey`);
  }

  /** URL de descarga de la plantilla (enlace directo, no XHR). */
  templateUrl(rows: number, operadora?: string): string {
    const params = new URLSearchParams({ rows: String(rows) });
    if (operadora) params.set('operadora', operadora);
    return `${this.base}/api/notebooks/template?${params.toString()}`;
  }
}
