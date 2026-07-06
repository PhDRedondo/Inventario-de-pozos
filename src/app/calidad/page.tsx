"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAttributeLabel } from "@/lib/attributes";
import { NotebookInventory } from "@/components/NotebookInventory";
import { RoleWorkflowSteps, roleWorkflowIntro } from "@/components/RoleWorkflowSteps";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/AppPreferences";
import type { ValidationResult } from "@/lib/types";

function AnhQualityView() {
  const t = useT();
  const { user } = useAuth();
  const [report, setReport] = useState<ValidationResult[]>([]);
  const [filter, setFilter] = useState<"all" | "errors" | "warnings">("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/validations")
      .then((r) => r.json())
      .then(setReport)
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "errors") return report.filter((r) => !r.is_valid);
    if (filter === "warnings") return report.filter((r) => r.is_valid && r.warning_count > 0);
    return report;
  }, [report, filter]);

  const byOperadora = useMemo(() => {
    const map = new Map<string, { errores: number; advertencias: number }>();
    for (const row of report) {
      const key = row.operadora ?? t("common.noOperator");
      const current = map.get(key) ?? { errores: 0, advertencias: 0 };
      current.errores += row.error_count;
      current.advertencias += row.warning_count;
      map.set(key, current);
    }
    return Array.from(map.entries())
      .map(([operadora, counts]) => ({ operadora, ...counts }))
      .sort((a, b) => b.errores + b.advertencias - (a.errores + a.advertencias))
      .slice(0, 10);
  }, [report, t]);

  const totals = useMemo(
    () => ({
      errores: report.reduce((s, r) => s + r.error_count, 0),
      advertencias: report.reduce((s, r) => s + r.warning_count, 0),
      pozosConErrores: report.filter((r) => !r.is_valid).length,
      pozosConAdvertencias: report.filter((r) => r.is_valid && r.warning_count > 0).length,
    }),
    [report],
  );

  async function exportReport() {
    setExporting(true);
    try {
      const response = await fetch(`/api/validations/export?filter=${filter}`);
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "informe-calidad-inventario-pozos-anh.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(t("quality.exportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("quality.title")}
        description={user ? t(roleWorkflowIntro(user.role, "quality")) : t("quality.description")}
        action={
          <button type="button" className="btn-secondary" onClick={exportReport} disabled={exporting}>
            {exporting ? t("quality.exporting") : t("quality.export")}
          </button>
        }
      />
      {user && <RoleWorkflowSteps role={user.role} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-anh-muted">{t("quality.totalErrors")}</p>
          <p className="text-2xl font-bold text-red-700">{totals.errores}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-anh-muted">{t("quality.totalWarnings")}</p>
          <p className="text-2xl font-bold text-amber-700">{totals.advertencias}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-anh-muted">{t("quality.wellsErrors")}</p>
          <p className="text-2xl font-bold">{totals.pozosConErrores}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-anh-muted">{t("quality.wellsWarnings")}</p>
          <p className="text-2xl font-bold">{totals.pozosConAdvertencias}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3" data-tour="quality-panel">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-anh-border px-4 py-3 font-bold text-anh-primary">{t("quality.findingsTitle")}</div>
          <div className="hidden max-h-[36rem] overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-anh-bg text-left text-anh-muted">
                <tr>
                  <th className="px-4 py-3">{t("common.operator")}</th>
                  <th className="px-4 py-3">{t("common.well")}</th>
                  <th className="px-4 py-3">{t("quality.colAttribute")}</th>
                  <th className="px-4 py-3">{t("quality.colSeverity")}</th>
                  <th className="px-4 py-3">{t("quality.colMessage")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.flatMap((row) =>
                  row.issues.map((issue, idx) => (
                    <tr key={`${row.well_id}-${idx}`} className="border-t border-anh-border align-top">
                      <td className="px-4 py-3">{row.operadora}</td>
                      <td className="px-4 py-3">{row.nombre_pozo_sgc}</td>
                      <td className="px-4 py-3 text-xs">{getAttributeLabel(issue.field)}</td>
                      <td className="px-4 py-3">
                        <span className={issue.severity === "error" ? "badge-invalid" : "badge-warning"}>
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3">{issue.message}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-4 font-bold text-anh-primary">{t("quality.topOperators")}</h3>
          <div className="space-y-3">
            {byOperadora.map((item) => (
              <div key={item.operadora} className="rounded-lg border border-anh-border p-3">
                <p className="text-sm font-semibold">{item.operadora}</p>
                <div className="mt-2 flex gap-4 text-xs">
                  <span className="text-red-700">{t("quality.errorsLabel", { count: item.errores })}</span>
                  <span className="text-amber-700">{t("quality.warningsLabel", { count: item.advertencias })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CalidadPage() {
  const t = useT();
  const { user } = useAuth();
  const router = useRouter();
  const [operadoras, setOperadoras] = useState<string[]>([]);
  const [adminOperadora, setAdminOperadora] = useState("");

  useEffect(() => {
    if (user?.role === "anh") {
      router.replace("/analitica");
    }
  }, [user, router]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/catalogs")
        .then((r) => r.json())
        .then((c) => setOperadoras(c.operadoras ?? []))
        .catch(console.error);
    }
  }, [user]);

  if (user?.role === "anh") {
    return <div className="card p-8 text-center text-anh-muted">{t("common.loading")}</div>;
  }

  if (user?.role === "operadora" && user.operadora) {
    return <NotebookInventory operadora={user.operadora} />;
  }

  if (user?.role === "admin") {
    return (
      <NotebookInventory
        operadora={adminOperadora}
        isAdmin
        operadoras={operadoras}
        onOperadoraChange={setAdminOperadora}
      />
    );
  }

  return <AnhQualityView />;
}
