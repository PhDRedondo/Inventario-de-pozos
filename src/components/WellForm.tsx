"use client";

import { useEffect, useMemo, useState } from "react";
import { THEMES } from "@/lib/catalogs";
import type { FieldDefinition, ValidationResult, WellRecord } from "@/lib/types";
import { PageHeader } from "@/components/ui";

type Catalogs = Record<string, string[] | Record<string, unknown>>;

const EMPTY_RECORD: WellRecord = {
  pozo_existente_avm: null,
  operadora: null,
  contrato: null,
  campo_avm: null,
  pozo_formacion_avm: null,
  pozo_avm: null,
  formacion_avm: null,
  formacion_forma_9sh: null,
  formacion_ruty: null,
  yacimiento_ruty: null,
  tipo_angulo: null,
  tipo_trayectoria: null,
  tipo_objetivo: null,
  tipo_terminacion: null,
  sistema_levantamiento: null,
  clasificacion_lahee: null,
  nombre_pozo_forma_6cr: null,
  uwi_sgc: null,
  uwi_fiscalizado: null,
  nombre_pozo_sgc: null,
  estado_pozo: null,
  departamento: null,
  municipio: null,
  codigo_dane_depto: null,
  codigo_dane_muni: null,
  locacion_cluster: null,
  coord_bogota_x: null,
  coord_bogota_y: null,
  coord_nacional_x: null,
  coord_nacional_y: null,
  longitud: null,
  latitud: null,
  prod_dias: null,
  prod_petroleo: null,
  prod_agua: null,
  prod_gas: null,
  iny_dias: null,
  iny_agua: null,
  iny_gas: null,
  iny_otros: null,
};

export function WellForm({
  onSubmit,
  submitLabel = "Guardar registro",
}: {
  onSubmit: (record: WellRecord) => Promise<ValidationResult | void>;
  submitLabel?: string;
}) {
  const [catalogs, setCatalogs] = useState<Catalogs>({});
  const [record, setRecord] = useState<WellRecord>(EMPTY_RECORD);
  const [uwiPreview, setUwiPreview] = useState<string | null>(null);
  const [uwiComponents, setUwiComponents] = useState<Record<string, string> | null>(null);
  const [uwiIssues, setUwiIssues] = useState<Array<{ severity: string; message: string }>>([]);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/catalogs")
      .then((r) => r.json())
      .then(setCatalogs)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await fetch("/api/uwi/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const data = await res.json();
      setUwiPreview(data.uwi_fiscalizado ?? null);
      setUwiComponents(data.components ?? null);
      setUwiIssues(data.issues ?? []);
    }, 400);
    return () => clearTimeout(timer);
  }, [record]);

  const municipios = useMemo(() => {
    const all = catalogs.municipios_dane as Record<string, { nombre: string; dept_code: string }> | undefined;
    if (!all || !record.departamento) return [];
    const depts = catalogs.departamentos_dane as Record<string, string> | undefined;
    const deptCode = depts
      ? Object.entries(depts).find(([, n]) => n.toUpperCase() === record.departamento?.toUpperCase())?.[0]
      : null;
    if (!deptCode) return Object.values(all).map((m) => m.nombre).sort();
    return Object.entries(all)
      .filter(([, m]) => m.dept_code === deptCode)
      .map(([, m]) => m.nombre)
      .sort();
  }, [catalogs, record.departamento]);

  useEffect(() => {
    if (!record.departamento && !record.municipio) return;
    const depts = catalogs.departamentos_dane as Record<string, string> | undefined;
    const munis = catalogs.municipios_dane as Record<string, { nombre: string; dept_code: string }> | undefined;
    let codigo_dane_depto: string | null = null;
    let codigo_dane_muni: string | null = null;

    if (depts && record.departamento) {
      codigo_dane_depto = Object.entries(depts).find(([, n]) => n.toUpperCase() === record.departamento?.toUpperCase())?.[0] ?? null;
    }
    if (munis && record.municipio) {
      const entry = Object.entries(munis).find(([, m]) => m.nombre.toUpperCase() === record.municipio?.toUpperCase());
      codigo_dane_muni = entry?.[0] ?? null;
      if (entry) codigo_dane_depto = entry[1].dept_code;
    }

    setRecord((prev) => {
      if (prev.codigo_dane_depto === codigo_dane_depto && prev.codigo_dane_muni === codigo_dane_muni) {
        return prev;
      }
      return { ...prev, codigo_dane_depto, codigo_dane_muni };
    });
  }, [record.departamento, record.municipio, catalogs]);

  function getOptions(field: FieldDefinition): string[] {
    if (field.key === "municipio") return municipios;
    if (!field.catalogKey) return [];
    const catalog = catalogs[field.catalogKey];
    return Array.isArray(catalog) ? catalog : [];
  }

  function updateField(key: keyof WellRecord, value: string) {
    setRecord((prev) => ({ ...prev, [key]: value || null }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const validation = await onSubmit({ ...record, uwi_fiscalizado: uwiPreview });
      if (validation) setResult(validation);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card border-anh-secondary/30 bg-green-50 p-4">
        <p className="text-sm font-semibold text-anh-primary">UWI fiscalizado (vista previa — instructivo ANH abril 2026)</p>
        <p className="mt-1 font-mono text-lg font-bold text-anh-secondary">{uwiPreview ?? "Complete ubicación y clasificación del pozo"}</p>
        {uwiComponents && (
          <div className="mt-3 grid gap-1 font-mono text-xs text-anh-muted sm:grid-cols-2">
            <span>Depto: {uwiComponents.departamento} · Muni: {uwiComponents.municipio}</span>
            <span>Sigla: {uwiComponents.sigla} · Nº: {uwiComponents.numero}</span>
            <span>Clúster: {uwiComponents.cluster} · Ángulo: {uwiComponents.angulo || "—"}</span>
            <span>Trayectoria: {uwiComponents.trayectoria || "—"} · Objetivo: {uwiComponents.objetivo || "—"}</span>
            {uwiComponents.terminacion && <span>Terminación: -{uwiComponents.terminacion}</span>}
          </div>
        )}
        {uwiIssues.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {uwiIssues.map((issue, i) => (
              <li key={i} className={issue.severity === "error" ? "text-red-700" : "text-amber-700"}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {THEMES.map((theme) => (
        <section key={theme.id} className="card p-5">
          <h3 className="text-lg font-bold text-anh-primary">{theme.title}</h3>
          <p className="mb-4 text-sm text-anh-muted">{theme.description}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {theme.fields.map((field) => (
              <div key={String(field.key)} className={field.type === "coordinate" ? "" : ""}>
                <label className="mb-1 block text-sm font-semibold text-anh-text">
                  {field.label}
                  {field.required && <span className="text-anh-danger"> *</span>}
                </label>
                {field.type === "select" ? (
                  <select
                    className="input-field"
                    value={(record[field.key] as string) ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    required={field.required}
                  >
                    <option value="">Seleccione...</option>
                    {getOptions(field).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === "readonly" ? (
                  <input className="input-field bg-anh-bg" readOnly value={(record[field.key] as string) ?? ""} />
                ) : (
                  <input
                    className="input-field"
                    type={field.type === "number" ? "number" : "text"}
                    placeholder={field.placeholder}
                    value={(record[field.key] as string) ?? ""}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    required={field.required}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Procesando..." : submitLabel}
        </button>
      </div>

      {result && (
        <div className={`card p-4 ${result.is_valid ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
          <p className="font-bold text-anh-primary">
            {result.is_valid ? "Registro procesado" : "Registro con errores"} — {result.error_count} errores,{" "}
            {result.warning_count} advertencias
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {result.issues.map((issue, i) => (
              <li key={i} className={issue.severity === "error" ? "text-red-700" : issue.severity === "warning" ? "text-amber-700" : "text-anh-muted"}>
                <strong>{issue.field}:</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export function UploadPageHeader() {
  return (
    <PageHeader
      title="Cargar inventario"
      description="Las operadoras remiten el formato de inventario de pozos por correo electrónico. Desde aquí el funcionario ANH carga manualmente el archivo recibido para validarlo, asignar el UWI fiscalizado y consolidar la información nacional."
    />
  );
}
