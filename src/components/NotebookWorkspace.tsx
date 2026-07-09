"use client";

import Link from "next/link";
import { ArrowLeft, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAttributeLabel } from "@/lib/attributes";
import { PageHeader } from "@/components/ui";
import { useT } from "@/context/AppPreferences";
import { useOperatorBrand } from "@/hooks/useOperatorBrand";
import {
  countIssues,
  flattenFindings,
  severityBadgeClass,
  type FindingFilter,
} from "@/lib/validation-findings";
import type { Notebook, NotebookEvent, NotebookVersion, ValidationIssue, ValidationResult } from "@/lib/types";

interface NotebookDetail {
  notebook: Notebook;
  versions: NotebookVersion[];
  activeVersion: NotebookVersion | null;
  events: NotebookEvent[];
}

interface NotebookWorkspaceProps {
  notebookId: number;
  operadora?: string;
  isAdmin?: boolean;
}

function eventLabel(t: ReturnType<typeof useT>, event: NotebookEvent) {
  if (event.event_type === "created") return t("notebook.eventCreated");
  if (event.event_type === "upload") return t("notebook.eventUpload");
  if (event.event_type === "submit") return t("notebook.eventSubmit");
  return t("notebook.eventArchived");
}

function severityLabel(t: ReturnType<typeof useT>, severity: ValidationIssue["severity"]) {
  if (severity === "error") return t("quality.severityError");
  if (severity === "warning") return t("quality.severityWarning");
  return t("quality.severityInfo");
}

export function NotebookWorkspace({ notebookId, operadora, isAdmin = false }: NotebookWorkspaceProps) {
  const t = useT();
  const operatorBrand = useOperatorBrand();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detail, setDetail] = useState<NotebookDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [report, setReport] = useState<ValidationResult[]>([]);
  const [filter, setFilter] = useState<FindingFilter>("all");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedVersion = useMemo(() => {
    if (!detail) return null;
    if (selectedVersionId) {
      return detail.versions.find((v) => v.id === selectedVersionId) ?? detail.activeVersion;
    }
    return detail.activeVersion;
  }, [detail, selectedVersionId]);

  const isActiveNotebook = detail?.notebook.status === "active";
  const canApply =
    isActiveNotebook &&
    selectedVersion?.id === detail?.notebook.active_version_id &&
    (selectedVersion?.invalid_records ?? 0) === 0 &&
    (selectedVersion?.total_records ?? 0) > 0;

  const loadNotebook = useCallback(async () => {
    const q =
      isAdmin && operadora ? `?operadora=${encodeURIComponent(operadora)}` : "";
    const res = await fetch(`/api/notebooks/${notebookId}${q}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? t("notebook.loadError"));
    setDetail(data);
    setSelectedVersionId(data.activeVersion?.id ?? null);
  }, [notebookId, isAdmin, operadora, t]);

  const loadReport = useCallback(async (versionId: number | null) => {
    if (!versionId) {
      setReport([]);
      return;
    }
    const res = await fetch(`/api/validations?uploadId=${versionId}`);
    setReport(await res.json());
  }, []);

  useEffect(() => {
    loadNotebook().catch((err) => setError(err instanceof Error ? err.message : t("common.unknownError")));
  }, [loadNotebook, t]);

  useEffect(() => {
    loadReport(selectedVersion?.id ?? null).catch(console.error);
  }, [selectedVersion?.id, loadReport]);

  useEffect(() => {
    if ((selectedVersion?.invalid_records ?? 0) > 0) {
      setFilter("errors");
    } else {
      setFilter("all");
    }
  }, [selectedVersion?.id, selectedVersion?.invalid_records]);

  function pickFile(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    const ext = next.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      setError(t("upload.fileTypeError"));
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setFile(next);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    if (isAdmin && detail) formData.append("operadora", detail.notebook.operadora);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("upload.processError"));
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadNotebook();
      setSelectedVersionId(data.version?.id ?? null);
      setMessage(t("notebook.versionCreated", { version: data.version?.version_number ?? "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setUploading(false);
    }
  }

  async function handleApply() {
    if (!detail) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operadora: detail.notebook.operadora }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("upload.submitError"));
      setMessage(data.message ?? t("notebook.applied"));
      await loadNotebook();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function exportReport() {
    if (!selectedVersion) return;
    setExporting(true);
    try {
      const response = await fetch(
        `/api/validations/export?filter=${filter}&uploadId=${selectedVersion.id}`,
      );
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `informe-cuaderno-v${selectedVersion.version_number}-anh.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(t("quality.exportError"));
    } finally {
      setExporting(false);
    }
  }

  const issueCounts = useMemo(() => countIssues(report), [report]);

  const findingRows = useMemo(
    () =>
      flattenFindings(report, filter).map((row) => ({
        key: row.key,
        well: row.well,
        fieldLabel: getAttributeLabel(row.field),
        severity: row.severity,
        severityLabel: severityLabel(t, row.severity),
        message: row.message,
      })),
    [report, filter, t],
  );

  const emptyFilterHint = useMemo(() => {
    if (findingRows.length > 0) return null;
    if (filter === "warnings" && issueCounts.errors > 0 && issueCounts.warnings + issueCounts.info === 0) {
      return t("quality.noFindingsTryErrors", { count: issueCounts.errors });
    }
    if (filter === "errors" && issueCounts.errors === 0 && issueCounts.warnings + issueCounts.info > 0) {
      return t("quality.noFindingsTryWarnings", { count: issueCounts.warnings + issueCounts.info });
    }
    return t("quality.noFindingsFiltered");
  }, [findingRows.length, filter, issueCounts, t]);

  const totals = useMemo(
    () => ({
      total: selectedVersion?.total_records ?? 0,
      valid: selectedVersion?.valid_records ?? 0,
      errores: issueCounts.errors,
      advertencias: issueCounts.warnings + issueCounts.info,
    }),
    [issueCounts, selectedVersion],
  );

  const filterButtons = [
    { key: "all" as const, label: t("quality.filterAll") },
    { key: "errors" as const, label: t("quality.filterErrors") },
    { key: "warnings" as const, label: t("quality.filterWarnings") },
  ];

  if (!detail) {
    return <div className="card p-8 text-center text-anh-muted">{t("common.loading")}</div>;
  }

  return (
    <div>
      <Link href="/calidad" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-anh-secondary">
        <ArrowLeft className="h-4 w-4" />
        {t("notebook.backToInventory")}
      </Link>

      <PageHeader
        title={detail.notebook.title || t("notebook.untitled", { id: detail.notebook.id })}
        description={
          detail.notebook.status === "active"
            ? t("notebook.statusActive")
            : t("notebook.statusSubmitted", {
                date: detail.notebook.submitted_at
                  ? new Date(detail.notebook.submitted_at).toLocaleString()
                  : "",
              })
        }
        action={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              className="btn-secondary"
              onClick={exportReport}
              disabled={exporting || !selectedVersion}
            >
              {exporting ? t("quality.exporting") : t("notebook.exportVersion")}
            </button>
            {isActiveNotebook && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleApply}
                disabled={submitting || !canApply}
                title={!canApply ? t("quality.applyDisabledHint") : undefined}
              >
                {submitting ? t("upload.submitting") : t("upload.applyToAnh")}
              </button>
            )}
          </div>
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-anh-muted">{t("notebook.label")}</p>
            <p className="text-lg font-extrabold text-anh-primary">{detail.notebook.operadora}</p>
            <p className="mt-1 text-xs text-anh-muted">
              {t("notebook.createdAt", { date: new Date(detail.notebook.created_at).toLocaleString() })}
              {detail.notebook.created_by ? ` · ${detail.notebook.created_by}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.versions.map((version) => (
              <button
                key={version.id}
                type="button"
                onClick={() => setSelectedVersionId(version.id)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                  selectedVersion?.id === version.id
                    ? "border-anh-secondary bg-anh-secondary/10 font-bold text-anh-primary"
                    : "border-anh-border bg-anh-surface text-anh-muted hover:border-anh-secondary/50"
                }`}
              >
                <span className="block font-semibold">{t("notebook.version", { n: version.version_number ?? 1 })}</span>
                <span className="mt-0.5 block">
                  {version.valid_records} {t("status.validPlural").toLowerCase()} · {version.invalid_records}{" "}
                  {t("status.errors").toLowerCase()}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && (
        <div className="card mb-4 border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
          {message}
        </div>
      )}

      {error && (
        <div className="card mb-4 border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <h3 className="mb-1 font-bold text-anh-primary">{t("notebook.timelineTitle")}</h3>
          <p className="mb-4 text-xs text-anh-muted">{t("notebook.timelineHint")}</p>
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {detail.events.length === 0 ? (
              <p className="text-sm text-anh-muted">{t("notebook.noEvents")}</p>
            ) : (
              detail.events.map((event) => (
                <div key={event.id} className="flex gap-3 border-l-2 border-anh-secondary/40 pl-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-anh-primary">{eventLabel(t, event)}</p>
                    {event.message && <p className="text-sm text-anh-text">{event.message}</p>}
                    {event.metadata && event.event_type === "upload" && (
                      <p className="mt-1 text-xs text-anh-muted">
                        {t("notebook.eventUploadMeta", {
                          total: String(event.metadata.total_records ?? "—"),
                          valid: String(event.metadata.valid_records ?? "—"),
                          errors: String(event.metadata.invalid_records ?? "—"),
                        })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-anh-muted">
                      {new Date(event.created_at).toLocaleString()}
                      {event.actor_email ? ` · ${event.actor_email}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="card p-4">
            <p className="text-sm text-anh-muted">{t("upload.summaryTotal")}</p>
            <p className="text-2xl font-bold">{totals.total}</p>
          </div>
          <div className="card summary-valid p-4">
            <p className="text-sm text-anh-muted">{t("upload.summaryValid")}</p>
            <p className="text-2xl font-bold text-green-800 dark:text-green-300">{totals.valid}</p>
          </div>
        </div>
      </div>

      {isActiveNotebook && (
        <form
          onSubmit={handleUpload}
          className={`card mb-6 space-y-4 p-6 ${operatorBrand ? "operator-upload-card" : ""}`}
          data-tour="upload-form"
        >
          <div>
            <label className="mb-1 block text-sm font-semibold">
              {operatorBrand
                ? t("operatorBrand.uploadHint", { operator: operatorBrand.shortName })
                : t("notebook.uploadLabel")}
            </label>
            <div
              role="button"
              tabIndex={0}
              className={`file-drop-zone ${dragActive ? "file-drop-zone-active" : ""} ${file ? "file-drop-zone-filled" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <Upload
                className="h-8 w-8 shrink-0"
                style={operatorBrand ? { color: operatorBrand.primary } : undefined}
                aria-hidden
              />
              <div className="min-w-0 text-center sm:text-left">
                <p className="text-sm font-semibold text-anh-primary">
                  {file ? file.name : t("upload.fileDropLabel")}
                </p>
                {file && (
                  <p className="mt-1 text-xs text-anh-muted">
                    {(file.size / 1024).toFixed(1)} KB · {t("upload.fileReplaceHint")}
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <p className="mt-1 text-xs text-anh-muted">{t("notebook.uploadHint")}</p>
          </div>
          <button type="submit" className="btn-primary" disabled={uploading || !file}>
            {uploading ? t("upload.submitLoading") : t("notebook.validateVersion")}
          </button>
        </form>
      )}

      {selectedVersion && (selectedVersion.invalid_records ?? 0) > 0 && isActiveNotebook && (
        <div className="card mb-4 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {t("upload.fixErrorsHint")}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {filterButtons.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              filter === key ? "bg-anh-primary text-anh-surface" : "border border-anh-border bg-anh-surface text-anh-muted"
            }`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden" data-tour="quality-panel">
        <div className="border-b border-anh-border px-4 py-3 font-bold text-anh-primary">{t("quality.findingsTitle")}</div>
        {findingRows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-anh-muted">
            <p>{emptyFilterHint}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {findingRows.map((row) => (
                <article key={row.key} className="rounded-xl border border-anh-border bg-anh-bg/70 p-4">
                  <p className="font-semibold text-anh-primary">{row.well}</p>
                  <p className="mt-1 text-xs text-anh-muted">{row.fieldLabel}</p>
                  <p className="mt-2">
                    <span className={severityBadgeClass(row.severity)}>{row.severityLabel}</span>
                  </p>
                  <p className="mt-2 text-sm text-anh-text">{row.message}</p>
                </article>
              ))}
            </div>
            <div className="hidden max-h-[36rem] overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-anh-bg text-left text-anh-muted">
                  <tr>
                    <th className="px-4 py-3">{t("common.well")}</th>
                    <th className="px-4 py-3">{t("quality.colAttribute")}</th>
                    <th className="px-4 py-3">{t("quality.colSeverity")}</th>
                    <th className="px-4 py-3">{t("quality.colMessage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {findingRows.map((row) => (
                    <tr key={row.key} className="border-t border-anh-border align-top">
                      <td className="px-4 py-3 font-medium">{row.well}</td>
                      <td className="px-4 py-3 text-xs">{row.fieldLabel}</td>
                      <td className="px-4 py-3">
                        <span className={severityBadgeClass(row.severity)}>{row.severityLabel}</span>
                      </td>
                      <td className="px-4 py-3">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
