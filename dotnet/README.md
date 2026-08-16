# Backend .NET (Fase 2) — Anh.Vip

Segundo paso del plan de migración al stack institucional ANH
(**Angular + .NET + SQL Server**), descrito en
[`docs/guia-produccion-anh.html`](../docs/guia-produccion-anh.html) §4.

Backend en **ASP.NET Core (.NET 8) + Entity Framework Core** que mapea el
esquema `[vip]` de SQL Server (ver [`../migration/sqlserver`](../migration/sqlserver))
y porta el dominio desde el piloto Next.js (`src/lib/*.ts`).

> Estándar aplicado: **ANH-GTIC-MA-02 §10.2** — backend en Microsoft .NET (C#).

## Solución

| Proyecto | Rol |
|---|---|
| `src/Anh.Vip.Domain` | Dominio puro: entidades, **UWI** (`Uwi/`), **validación** (`Validation/`), **ETL geográfico** (`Etl/`, `Geo/`), **mapeo de columnas** (`Excel/`) e **ingesta** (`Ingest/WellIngestor.cs`). Sin dependencias. |
| `src/Anh.Vip.Infrastructure` | `VipDbContext` (EF Core, esquema `[vip]`), `DbCatalogProvider`, `DbGeographyResolver` y **`ExcelSheetReader`** (lectura de Excel con ClosedXML). |
| `src/Anh.Vip.Api` | Web API mínima: `/health` y `POST /api/uwi/preview`. |
| `tests/Anh.Vip.Domain.Tests` | Paridad con el piloto: UWI (instructivo) y validación (`validateWell`). |

## Requisitos

- **.NET SDK 8.0** (LTS).
- Para la API: una instancia SQL Server con el esquema de la Fase 1 aplicado
  (cadena en `src/Anh.Vip.Api/appsettings.json` → `ConnectionStrings:VipDb`).

## Compilar y probar

```bash
cd dotnet
dotnet restore
dotnet build
dotnet test            # ejecuta la paridad del UWI (8 casos del instructivo + 2 de nulos)
```

## Ejecutar la API

```bash
cd dotnet
dotnet run --project src/Anh.Vip.Api
# GET  /health
# POST /api/uwi/preview   (JSON con nombrePozoSgc, codigoDaneDepto, codigoDaneMuni, ...)
# Swagger UI en desarrollo: /swagger
```

`POST /api/uwi/preview` **no requiere base de datos** (solo lógica de dominio).

## Módulo portado en esta fase: UWI fiscalizado

`Uwi/UwiGenerator.cs` es un port **fiel** de `src/lib/uwi.ts`: replica la
semántica de JavaScript (`slice`, `padStart`, normalización NFD + quita
diacríticos, mismas expresiones regulares) para producir idénticos UWI. La
paridad se verifica contra los 8 casos de referencia del instructivo
(`INSTRUCTIVO_EXAMPLES`), por ejemplo:

| Nombre / clúster | UWI esperado |
|---|---|
| RUBIALES 323 / RUBIALES 323 | `50568RUBI0323C` |
| MORICHE 56 / 1289 | `15572MORI00561289` |
| AMBAR 157H ST1 / AMBAR 116 (H, ST, P, LR) | `50568AMBA0157AM0116HST1P-LR` |

## Módulo portado: motor de validación

`Validation/WellValidator.cs` es un port fiel de `validateWell` (validation.ts):
obligatorios, catálogos (vía `ICatalogProvider`), condicionales AVM y de
levantamiento, numéricos, coordenadas, y las reglas del instructivo UWI. La
verificación geográfica (`isCanonicalDepartamento`) y la reparación de mojibake
se portan en `Text/SpanishText.cs`. En pruebas usa un `InMemoryCatalogProvider`
alimentado por el mismo `data/seed.json`; en producción, `DbCatalogProvider`
carga los catálogos `cat_*` de SQL Server.

## Módulo portado: ETL geográfico + códigos DANE

`Geo/GeographyResolver.cs` (port de `etl.ts` + `resolveDaneCodes` de db.ts)
canoniza departamentos y municipios contra el catálogo DANE y asigna sus
códigos. `Etl/WellEtl.cs` (port de `normalizeWellRecordForIngest`) normaliza el
pozo antes de persistir, rellena el código DANE de departamento desde el
municipio y repara la codificación de los atributos de texto, emitiendo
hallazgos `etl_geography` / `etl_encoding` / `catalog_geography`.

> ⚠️ **Nota de correctitud:** no usar `InvariantGlobalization` — deshabilita ICU
> y rompe `String.Normalize(FormD)`, del que depende quitar tildes en la
> canonización. Detectado por la paridad del ETL (nombres con tildes).

## Módulo portado: ingesta de Excel

`Excel/ExcelColumnMap.cs` (port de `parseExcelRow` + los tres mapas de columnas)
convierte una fila en un pozo; `Infrastructure/Excel/ExcelSheetReader.cs` lee la
hoja INVENTARIO con ClosedXML replicando `sheet_to_json` (encabezados en la fila
1, `__EMPTY`/sufijos para vacíos y duplicados). `Ingest/WellIngestor.cs` compone
el pipeline completo — parseo → ETL → códigos DANE → validación — igual que
`saveWell`/`saveUploadBatch`, incluido el filtro de filas (OPERADORA presente y
sin «LISTA»).

## Estado de verificación

- ✅ **Compilación:** `dotnet build -c Release` de toda la solución (Domain,
  Infrastructure/EF Core, Api, Tests) con **0 advertencias y 0 errores**
  (SDK .NET 8.0.424).
- ✅ **`dotnet test`:** **23/23 pruebas superadas**:
  - **UWI (10):** 8 casos del instructivo (`INSTRUCTIVO_EXAMPLES`) + 2 de nulos.
  - **Validación (5):** paridad de `validateWell` contra la salida canónica del
    piloto para 3 registros de referencia (`Fixtures/validation-parity.json`),
    el conteo de 59 reglas activas y el resumen agregado.
  - **ETL (6):** paridad de `normalizeWellRecordForIngest` + `resolveDaneCodes`
    contra el piloto para 5 registros (limpio, minúsculas, desconocido,
    mojibake, vacío) (`Fixtures/etl-parity.json`) y `isCanonicalDepartamento`.
  - **Ingesta (2):** paridad de extremo a extremo desde un `.xlsx` real
    (`Fixtures/inventario-sample.xlsx`) — parseo, ETL, DANE, UWI, estado y
    hallazgos de cada pozo, más el filtro de la fila «LISTA»
    (`Fixtures/ingestion-parity.json`).

Reproducir:

```bash
cd dotnet && dotnet build -c Release && dotnet test
```

## Siguiente en Fase 2

- Port del motor de **validación** (`validation.ts` → servicio C#) y del **ETL**
  (`etl.ts`), consultando los catálogos `cat_*` vía EF Core.
- Endpoints de cuadernos, cargue (lectura de Excel con ClosedXML/EPPlus) y panel.
- Migraciones EF Core alineadas al DDL de la Fase 1.
