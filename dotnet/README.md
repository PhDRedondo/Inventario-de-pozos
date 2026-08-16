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
| `src/Anh.Vip.Infrastructure` | `VipDbContext` (EF Core, esquema `[vip]`) + **migraciones** (`Migrations/`), `DbCatalogProvider`, `DbGeographyResolver`, `ExcelSheetReader` (ClosedXML), `CatalogCache` y `NotebookUploadService` (ingesta + persistencia). |
| `src/Anh.Vip.Api` | Web API: `/health`, `POST /api/uwi/preview`, **cuadernos** (crear, cargar, consultar, aplicar, validaciones, **plantilla**), **panel** (`/api/stats`) y **analítica comparativa** (`/api/analytics`). Autenticación JWT/OIDC + roles. |
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
# POST /api/uwi/preview          (JSON; no requiere base de datos)
# GET  /api/notebooks?operadora=  (listar cuadernos, alcance por rol)
# POST /api/notebooks            (crear cuaderno: { operadora, title })
# POST /api/notebooks/{id}/upload (multipart 'file' = .xlsx; crea una versión)
# POST /api/notebooks/{id}/submit (aplica el inventario a la ANH)
# GET  /api/notebooks/{id}       (versiones y eventos)
# GET  /api/validations?uploadId= (hallazgos de una versión)
# GET  /api/notebooks/template?rows=N&operadora= (descarga la plantilla .xlsx)
# GET  /api/stats?limit=            (KPIs y desgloses del panel, alcance por rol)
# GET  /api/wells/map               (pozos georreferenciados para el mapa)
# GET  /api/analytics?entityType=&entity=  (radar comparativo vs nacional; anh|admin)
# GET  /api/analytics/sankey        (flujo Departamento->Estado->Operadora; anh|admin)
# Swagger UI en desarrollo: /swagger
```

### Perfil de desarrollo (InMemory + catálogos sembrados)

Para probar el stack completo **sin SQL Server**, el perfil de desarrollo usa
EF Core InMemory y siembra los catálogos oficiales desde `seed.json` al iniciar
(configurado en `appsettings.Development.json` → `UseInMemoryDatabase: true`;
`launchSettings.json` lo expone en `http://localhost:5199`).

```bash
cd dotnet
dotnet run --project src/Anh.Vip.Api          # perfil dev: InMemory + seed en :5199
# En otra terminal, el frontend Angular (proxy /api -> :5199):
cd ../vip-web && npm start                     # http://localhost:4200
```

Así se ejecuta **Angular → API .NET → almacén en memoria** de extremo a extremo.
En producción, sin `UseInMemoryDatabase`, la API usa SQL Server (esquema `[vip]`).

`POST /api/notebooks/{id}/upload` compone toda la ingesta: lee la hoja
INVENTARIO con `ExcelSheetReader`, ingiere con `WellIngestor` (catálogos/DANE
desde SQL Server vía `CatalogCache`) y persiste el lote (upload, wells, issues,
evento) con EF Core, replicando `addNotebookVersion`/`saveUploadBatch`.

> Nota: los endpoints aún **no tienen autenticación** (el upload usa
> `DisableAntiforgery`); AD/OIDC + MFA y CSRF institucional entran en la fase de
> seguridad (ver guía de producción §4, fase 4).

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

## Seguridad (Fase 4)

Autenticación y autorización conforme a **GU-18 Anexo 2**:

- **Autenticación:** JWT **Bearer** contra el proveedor **OIDC/AD** institucional
  (Microsoft Entra ID / AD FS). Se configura con `Oidc:Authority` y
  `Oidc:Audience` (appsettings/entorno). El **MFA (doble factor)** lo exige el
  IdP en el login; la API solo valida el token resultante.
- **Autorización por rol** (segregación de funciones): políticas
  `OperatorOrAdmin` (crear/cargar/enviar cuadernos, plantilla) y `ReadInventory`
  (validaciones: operadora, anh, admin). `/health` es anónimo.
- **Identidad del actor** desde los claims del token (email, `operadora`); la
  operadora se **fuerza al alcance del usuario** para el rol operadora.
- **Endurecimiento:** cabeceras `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`; HSTS fuera de desarrollo. El upload usa Bearer (sin cookies),
  lo que mitiga CSRF.
- **Perfil de desarrollo:** un esquema `Dev` auto-autentica un usuario demo (todos
  los roles) para el stack local; **nunca** se habilita en producción.

> Pendiente institucional: registrar la app en Entra ID / AD FS (Authority,
> Audience, roles) y validar MFA extremo a extremo con el tenant de la ANH.

## Migraciones EF Core (esquema SQL Server)

El esquema `[vip]` se gestiona con **migraciones EF Core** (carpeta
`src/Anh.Vip.Infrastructure/Migrations/`). Es el esquema canónico del backend
.NET y está alineado con el DDL de la Fase 1
([`../migration/sqlserver`](../migration/sqlserver)), que se conserva como
referencia para DBAs sin .NET.

`VipDbContextFactory` (diseño) permite ejecutar las herramientas sin la API; la
cadena de conexión sale de la variable `VIP_DB` o de un valor local por defecto.

```bash
# Instalar la herramienta (una vez)
dotnet tool install --global dotnet-ef --version 8.0.8

cd dotnet
# Aplicar a una base SQL Server (VIP_DB = cadena de conexión)
VIP_DB="Server=...;Database=VIP_Inventario;..." \
  dotnet ef database update --project src/Anh.Vip.Infrastructure --startup-project src/Anh.Vip.Infrastructure

# O generar el script idempotente para que la OTI lo aplique con SSMS/sqlcmd
dotnet ef migrations script --idempotent \
  --project src/Anh.Vip.Infrastructure --startup-project src/Anh.Vip.Infrastructure -o vip-schema.sql
```

> Las migraciones **no** se aplican automáticamente al iniciar la API (el
> despliegue del esquema es una compuerta controlada por la OTI, conforme al
> control de cambios del MA-02).

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
- ✅ **`dotnet test`:** **47/47 pruebas superadas**:
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
  - **Panel (3):** `/api/stats` con alcance por rol — admin ve los 12 pozos del
    inventario demo, operadora solo los suyos (3), y sin token → 401.
  - **Mapa (2):** `/api/wells/map` — 12 pozos georreferenciados con lat/lng
    válidas; sin token → 401.
  - **Analítica (5):** `/api/analytics` — tema `perfil` nacional con índice 100 en
    cada métrica, entidad (operadora) con índices relativos, rol operadora → 403;
    tema `produccion` con métricas numéricas (petróleo/gas/agua/días) promediadas
    y valor nacional > 0; y `/api/analytics/sankey` con las tres columnas y los
    enlaces del flujo. Los temas `produccion`/`inyeccion` promedian las columnas
    de producción/inyección por entidad frente al nacional (base 100).
  - **Seguridad (6):** autorización por rol con `WebApplicationFactory` y un
    esquema de autenticación de prueba — `/health` anónimo, 401 sin token, 403
    con rol insuficiente (anh crea cuaderno / rol desconocido consulta), 200 con
    rol válido, y operadora forzada + actor tomado de los claims.
  - **Listado (2):** `GET /api/notebooks` — devuelve los cuadernos creados con su
    conteo de versiones; la operadora solo ve los suyos.
  - **API (6):** integración con `WebApplicationFactory` + EF Core InMemory
    (catálogos sembrados desde `seed.json`): **carga** (persistencia de upload,
    2 pozos con operadora forzada, hallazgos, UWI `50568RUBI…`, versión activa,
    eventos; segunda versión; 404); **submit** (400 con errores / 200 aplicado y
    marcado `submitted`); **validaciones** (hallazgos por versión); y **plantilla**
    (37 encabezados, N filas, operadora prellenada, hojas Listas/Instrucciones y
    selectores).
- ✅ **Migración `InitialCreate`:** compila y genera **T-SQL válido** (10 tablas
  en `[vip]`, 9 índices, columnas dimensionadas e indexables). ⛔ **Aplicación a
  una instancia SQL Server real:** pendiente (no hay instancia en este entorno);
  ejecutar `dotnet ef database update` contra una base 2019/2022 de la OTI.

Reproducir:

```bash
cd dotnet && dotnet build -c Release && dotnet test
```

## Siguiente en Fase 2

- Port del motor de **validación** (`validation.ts` → servicio C#) y del **ETL**
  (`etl.ts`), consultando los catálogos `cat_*` vía EF Core.
- Endpoints de cuadernos, cargue (lectura de Excel con ClosedXML/EPPlus) y panel.
- Migraciones EF Core alineadas al DDL de la Fase 1.
