# Migración a SQL Server — Fase 1 (esquema + catálogos)

Primer paso del plan de migración al stack institucional ANH
(**Angular + .NET + SQL Server**), descrito en
[`docs/guia-produccion-anh.html`](../../docs/guia-produccion-anh.html) §4.

Esta fase **solo cubre la capa de datos**: crea el esquema en SQL Server y
carga los catálogos oficiales. El backend .NET (EF Core) y el frontend Angular
son fases posteriores.

> Estándar aplicado: **ANH-GTIC-MA-02 §9.1.1.3.1** — el gestor institucional es
> Microsoft SQL Server (línea base 2019, nuevos despliegues 2022).

## Archivos

| Archivo | Contenido |
|---|---|
| `01_schema.sql` | Esquema núcleo `[vip]`: `users`, `audit_log`, `notebooks`, `uploads`, `wells`, `validation_issues`, `notebook_events` (PK, FK, índices, CHECK). |
| `02_catalogs_schema.sql` | Tablas de catálogo: `cat_departamento`, `cat_municipio` (DANE) y `cat_lista_valor` (listas del formato). |
| `03_catalogs_data.sql` | **Generado** — datos de catálogos desde `data/seed.json`. No editar a mano. |
| `tools/generate-catalog-sql.mjs` | Generador reproducible de `03_catalogs_data.sql`. |

## Orden de ejecución

```bash
# 1. Crear una base de datos vacía en la instancia SQL Server (2019/2022), p. ej. VIP_Inventario
# 2. Ejecutar en orden (sqlcmd, Azure Data Studio o SSMS):
sqlcmd -S <servidor> -d VIP_Inventario -i 01_schema.sql
sqlcmd -S <servidor> -d VIP_Inventario -i 02_catalogs_schema.sql
sqlcmd -S <servidor> -d VIP_Inventario -i 03_catalogs_data.sql
```

Los tres scripts son **idempotentes**: el esquema usa `IF OBJECT_ID ... IS NULL`
y la carga de catálogos vacía y recarga cada tabla dentro de una transacción.

## Regenerar los catálogos

Si cambia `data/seed.json`, regenerar el SQL de datos:

```bash
node migration/sqlserver/tools/generate-catalog-sql.mjs
```

Contenido actual: **33** departamentos, **1122** municipios (DANE) y **13**
catálogos de lista (**434** valores): operadoras, contratos, campos AVM,
formaciones/yacimientos RUTY y los enumerados del formato (estado del pozo,
tipos de pozo, sistema de levantamiento, etc.).

## Decisiones de diseño

- **Esquema `[vip]`** para aislar los objetos de la herramienta.
- **NVARCHAR** en todo el texto (Unicode) para tildes y caracteres del español.
- **DATETIME2(3)** con `DEFAULT SYSUTCDATETIME()` (UTC) en marcas de tiempo.
- **Fidelidad de `wells`:** los 40 atributos del pozo se conservan como
  `NVARCHAR`, igual que el piloto, para preservar el ingreso crudo del Excel
  (la validación por reglas necesita almacenar incluso valores inválidos para
  reportarlos). El endurecimiento de tipos numéricos se hará en la Fase 2 junto
  con el port del motor de validación a C#.
- **Catálogos como tablas** (reemplazan a `seed.json`): la validación .NET
  consultará `cat_*` en lugar de un archivo embebido. La clave `catalogo` de
  `cat_lista_valor` coincide con las llaves que usa hoy `validation.ts`.

## Estado de verificación

- ✅ **Validación estática** del SQL generado: transacción balanceada, 4301
  literales `N'...'` correctamente cerrados, 16 `INSERT` de ≤900 filas (bajo el
  límite de 1000 de SQL Server), 1589 filas totales (33 + 1122 + 434).
- ⛔ **Ejecución contra un motor real:** *pendiente*. Este entorno no tiene una
  instancia SQL Server disponible (sin `sqlcmd`/`dotnet`, Docker detenido y
  host arm64). Debe ejecutarse contra una instancia 2019/2022 de la OTI (o local)
  para la validación de motor, como parte de la compuerta de la Fase 1.

## Siguiente paso (Fase 2)

Backend en **ASP.NET Core (.NET) + Entity Framework Core** mapeando este
esquema, y port del dominio (validación, UWI fiscalizado, ETL, plantilla) desde
`src/lib/*.ts`. Ver la hoja de ruta en la guía de producción.
