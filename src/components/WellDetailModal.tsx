"use client";

import dynamic from "next/dynamic";
import { Download, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MapLoadingPlaceholder } from "@/components/MapLoadingPlaceholder";
import { StatusBadge } from "@/components/ui";
import { WellReportSections } from "@/components/WellReportSections";
import { useAppPreferences } from "@/context/AppPreferences";
import { useAuth } from "@/context/AuthContext";
import { fixEncoding } from "@/lib/geo";
import { parseWellCoordinates } from "@/lib/well-coordinates";
import { downloadWellReportPdf } from "@/lib/well-report-pdf";
import type { ValidationIssue, WellRecord } from "@/lib/types";

const WellReportMap = dynamic(() => import("@/components/WellReportMap"), {
  ssr: false,
  loading: () => (
    <MapLoadingPlaceholder className="map-shell flex h-52 items-center justify-center rounded-xl border border-anh-border text-sm text-anh-muted" />
  ),
});

interface WellDetailModalProps {
  wellId: number;
  onClose: () => void;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function WellDetailModal({ wellId, onClose }: WellDetailModalProps) {
  const { t, locale } = useAppPreferences();
  const { user } = useAuth();
  const [data, setData] = useState<{ well: WellRecord; issues: ValidationIssue[]; canEdit?: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch(`/api/wells/${wellId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [wellId]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const coordinates = useMemo(() => (data ? parseWellCoordinates(data.well) : null), [data]);

  const sectionLabels = useMemo(
    () => ({
      locationMap: t("wellReport.locationMap"),
      noCoordinates: t("wellReport.noCoordinates"),
      validationSection: t("wellReport.validationSection"),
      none: t("common.none"),
      errorLabel: t("status.errors"),
      warningLabel: t("status.warnings"),
    }),
    [t],
  );

  const generatedAt = new Date().toLocaleString(locale === "en" ? "en-US" : "es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const handleDelete = useCallback(async () => {
    if (!window.confirm(t("admin.deleteWellConfirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/wells/${wellId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onClose();
      window.location.reload();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  }, [onClose, t, wellId]);

  const handleDownloadPdf = useCallback(async () => {
    if (!data) return;

    setExporting(true);
    setPdfError(null);
    try {
      const name = data.well.nombre_pozo_sgc ?? data.well.uwi_fiscalizado ?? `pozo-${wellId}`;
      const filename = `${t("wellReport.filePrefix")}-${slugify(name) || wellId}.pdf`;

      await downloadWellReportPdf({
        well: data.well,
        issues: data.issues,
        coordinates,
        generatedAt,
        filename,
        labels: {
          anhTitle: t("wellReport.anhTitle"),
          gopSystem: t("shell.gopSystem"),
          title: t("wellReport.title"),
          subtitle: t("wellReport.subtitle"),
          footer: t("wellReport.footer"),
          generatedAt: t("wellReport.generatedAt", { date: generatedAt }),
          locationMap: t("wellReport.locationMap"),
          noCoordinates: t("wellReport.noCoordinates"),
          validationSection: t("wellReport.validationSection"),
          none: t("common.none"),
          errorLabel: t("status.errors"),
          warningLabel: t("status.warnings"),
          uwiFiscal: t("wells.fields.uwiFiscal"),
          operadora: t("wells.fields.operadora"),
          estado: t("wells.fields.estado"),
          departamento: t("wells.fields.departamento"),
          municipio: t("wells.fields.municipio"),
          validation: t("common.validation"),
          statusValid: t("status.valid"),
          statusWarning: t("status.warning"),
          statusInvalid: t("status.invalid"),
          statusPending: t("status.pending"),
          coordinates: t("wellReport.coordinates"),
          mapAttribution: t("wellReport.mapAttribution"),
        },
      });
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error && error.message === "SATELLITE_MAP_UNAVAILABLE"
          ? t("wellReport.pdfMapError")
          : t("wellReport.pdfError");
      setPdfError(message);
    } finally {
      setExporting(false);
    }
  }, [coordinates, data, generatedAt, t, wellId]);

  if (!mounted) return null;

  const modal = (
    <div className="well-modal-root fixed inset-0 z-[2000] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="well-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label={t("common.close")}
        onClick={onClose}
      />

      <div
        className="well-modal-dialog relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-anh-border bg-anh-surface shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="well-report-title"
        data-tour="well-detail"
      >
        <div className="well-modal-accent h-1.5 shrink-0" />

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-anh-border px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-anh-secondary">{t("wellReport.title")}</p>
            {data ? (
              <>
                <h2 id="well-report-title" className="mt-1 truncate text-lg font-extrabold text-anh-primary sm:text-xl">
                  {data.well.nombre_pozo_sgc ?? t("wells.noUwi")}
                </h2>
                <p className="mt-0.5 truncate font-mono text-xs text-anh-muted sm:text-sm">
                  {data.well.uwi_fiscalizado ?? t("wells.noUwi")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-anh-muted">
                  <StatusBadge status={data.well.validation_status} />
                  {data.well.operadora && <span>{data.well.operadora}</span>}
                  {data.well.departamento && <span>{fixEncoding(data.well.departamento)}</span>}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-anh-muted">{t("wells.loadingDetail")}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {user?.role === "admin" && data && (
                <button
                  type="button"
                  className="btn-secondary text-xs text-anh-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? t("common.loading") : t("admin.deleteWell")}
                </button>
              )}
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2 text-xs"
                onClick={handleDownloadPdf}
                disabled={!data || exporting}
              >
                <Download className="h-4 w-4" />
                {exporting ? t("wellReport.generatingPdf") : t("wellReport.downloadPdf")}
              </button>
              <button
                type="button"
                className="btn-secondary flex h-9 w-9 items-center justify-center p-0"
                onClick={onClose}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {pdfError && <p className="max-w-[220px] text-right text-xs text-red-600 dark:text-red-300">{pdfError}</p>}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {!data ? (
            <div className="flex min-h-[240px] items-center justify-center text-anh-muted">{t("wells.loadingDetail")}</div>
          ) : (
            <WellReportSections
              well={data.well}
              issues={data.issues}
              labels={sectionLabels}
              mapSlot={
                coordinates ? (
                  <WellReportMap
                    lat={coordinates.lat}
                    lng={coordinates.lng}
                    validationStatus={data.well.validation_status}
                  />
                ) : (
                  <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-anh-border bg-anh-bg text-sm text-anh-muted">
                    {t("wellReport.noCoordinates")}
                  </div>
                )
              }
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
