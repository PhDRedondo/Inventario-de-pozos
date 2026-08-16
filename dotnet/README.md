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
| `src/Anh.Vip.Domain` | Dominio puro: entidades y lógica de negocio. **Módulo UWI portado** (`Uwi/UwiGenerator.cs`). Sin dependencias. |
| `src/Anh.Vip.Infrastructure` | `VipDbContext` (EF Core) mapeado al esquema `[vip]`. |
| `src/Anh.Vip.Api` | Web API mínima: `/health` y `POST /api/uwi/preview`. |
| `tests/Anh.Vip.Domain.Tests` | Paridad del UWI con el piloto (casos del instructivo). |

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

## Estado de verificación

- ✅ **Paridad de valores esperados** con el algoritmo canónico: los 8 UWI
  esperados provienen de `src/lib/uwi.ts` y se confirman con `npm run test:uwi`
  en el piloto. El port a C# se trazó a mano contra estos casos.
- ⛔ **Compilación y `dotnet test`:** *pendiente*. Este entorno no tiene el
  .NET SDK instalado, por lo que el código **no se compiló ni se ejecutó aquí**.
  Debe correrse `dotnet build` + `dotnet test` en una máquina con .NET 8
  (equipo de desarrollo u OTI) para cerrar la compuerta de esta fase.

## Siguiente en Fase 2

- Port del motor de **validación** (`validation.ts` → servicio C#) y del **ETL**
  (`etl.ts`), consultando los catálogos `cat_*` vía EF Core.
- Endpoints de cuadernos, cargue (lectura de Excel con ClosedXML/EPPlus) y panel.
- Migraciones EF Core alineadas al DDL de la Fase 1.
