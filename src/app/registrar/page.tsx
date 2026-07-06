"use client";

import { WellForm } from "@/components/WellForm";
import { PageHeader } from "@/components/ui";
import type { ValidationResult, WellRecord } from "@/lib/types";

export default function RegistrarPage() {
  async function handleSubmit(record: WellRecord): Promise<ValidationResult> {
    const res = await fetch("/api/wells", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    const data = await res.json();
    return data.validation;
  }

  return (
    <div>
      <PageHeader
        title="Registrar pozo"
        description="Formulario organizado por temas del inventario. Solo se muestran las opciones de las listas desplegables oficiales cuando aplica."
      />
      <WellForm onSubmit={handleSubmit} submitLabel="Registrar y validar pozo" />
    </div>
  );
}
