import { NextRequest, NextResponse } from "next/server";
import { previewUwi, resolveDaneCodes } from "@/lib/db";
import { buildUwiComponents, generateUwiFiscalizado, validateUwiInstructivo } from "@/lib/uwi";
import type { WellRecord } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as WellRecord;
  const dane = resolveDaneCodes(body.departamento, body.municipio);
  const record: WellRecord = {
    ...body,
    codigo_dane_depto: dane.codigo_dane_depto ?? body.codigo_dane_depto,
    codigo_dane_muni: dane.codigo_dane_muni ?? body.codigo_dane_muni,
  };

  const uwi_fiscalizado = generateUwiFiscalizado(record) ?? previewUwi(record);
  const components = buildUwiComponents(record);
  const issues = validateUwiInstructivo({ ...record, uwi_fiscalizado });

  return NextResponse.json({ uwi_fiscalizado, components, issues });
}
