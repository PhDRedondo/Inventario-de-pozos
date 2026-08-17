# Inventario de Pozos — ANH (Sistema GOP)

Sistema web de la **Agencia Nacional de Hidrocarburos (ANH)** para la recepción, validación, consolidación y consulta del inventario de pozos reportado por operadoras. Implementa el flujo institucional del **Sistema de Gestión de Operaciones y Producción (GOP)**, con asignación de **UWI fiscalizado** según el instructivo ANH (abril 2026).

También se le conoce por su sigla interna: **VIP — Validador del Inventario de Pozos**.

**Repositorio:** [github.com/PhDRedondo/Inventario-de-pozos](https://github.com/PhDRedondo/Inventario-de-pozos)

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16.2 (App Router), React 19.2, Tailwind CSS 4 |
| Backend | API Routes (mismo proceso Node.js — sin servicio aparte) |
| Base de datos | SQLite (`better-sqlite3` 12) |
| Excel | Lectura con `xlsx` (SheetJS) · generación/exportación con `ExcelJS` |
| Mapas / PDF | Leaflet + GeoJSON · `jsPDF` |
| i18n | Español (por defecto) / English |
| Despliegue | Vercel (SQLite efímero en `/tmp`) |

---

## Tabla de contenidos

- [Resumen ejecutivo](#resumen-ejecutivo)
- [Migración al stack institucional (ANH-GTIC-MA-02)](#migración-al-stack-institucional-anh-gtic-ma-02)
- [Arquitectura del sistema](#arquitectura-del-sistema)
  - [Vista de capas](#vista-de-capas)
  - [Ciclo de una petición](#ciclo-de-una-petición)
  - [Módulos principales](#módulos-principales)
- [Recorrido funcional de extremo a extremo](#recorrido-funcional-de-extremo-a-extremo)
- [Plantilla descargable del cuaderno](#plantilla-descargable-del-cuaderno)
- [Flujo de carga Excel y validación](#flujo-de-carga-excel-y-validación)
- [Cuadernos de inventario (versiones y trazabilidad)](#cuadernos-de-inventario-versiones-y-trazabilidad)
- [Autenticación, roles y rutas](#autenticación-roles-y-rutas)
- [Modelo de datos](#modelo-de-datos)
- [Roles y permisos](#roles-y-permisos)
- [Flujos por rol](#flujos-por-rol)
- [Validación y UWI fiscalizado](#validación-y-uwi-fiscalizado)
- [Conteos: pozos vs hallazgos](#conteos-pozos-vs-hallazgos)
- [Panel y analítica](#panel-y-analítica)
- [Landing pública](#landing-pública)
- [Inicio rápido](#inicio-rápido)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue en Vercel](#despliegue-en-vercel)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API principal](#api-principal)
- [Desarrollo y convenciones](#desarrollo-y-convenciones)
- [Acceso demo](#acceso-demo)
- [Scripts útiles](#scripts-útiles)
- [Guía de puesta en producción ANH](#guía-de-puesta-en-producción-anh)
- [Limitaciones y próximos pasos](#limitaciones-y-próximos-pasos)
- [Licencia y uso](#licencia-y-uso)

---

## Resumen ejecutivo

El sistema cubre el ciclo completo del inventario de pozos:

1. La **operadora** crea un **cuaderno de inventario**, indica cuántos pozos va a registrar y **descarga una plantilla Excel** con los encabezados oficiales, listas desplegables y filas listas para diligenciar.
2. Carga versiones del Excel diligenciado y **corrige hallazgos** hasta obtener **cero pozos inválidos** en la versión activa.
3. Al **aplicar el envío a la ANH**, el lote pasa de `draft` a `submitted`, queda visible en el panel institucional y se genera un paquete en `data/outbox/` (simulación de correo a `correspondenciaanh@anh.gov.co`).
4. **Funcionarios ANH** consultan el inventario **ya validado** en el panel y profundizan en **analítica comparativa** (radar, mapas térmicos, nubes de producción).
5. El **administrador** gestiona usuarios y puede operar cuadernos en nombre de cualquier operadora.

Los **40 atributos** del formato Excel están centralizados en `src/lib/catalogs.ts` (temas) y `src/lib/attributes.ts` (29 columnas del mapa oficial + columnas especiales + UWI fiscalizado generado). La misma definición alimenta el **formulario, la validación, la plantilla descargable y el parser de carga**, de modo que las cuatro caras del sistema nunca se desincronizan.

---

## Migración al stack institucional (ANH-GTIC-MA-02)

El repositorio contiene **dos implementaciones** del mismo sistema:

| Implementación | Stack | Ubicación | Uso |
|---|---|---|---|
| **Piloto** (este README) | Next.js · React · SQLite | raíz del repo | Demo funcional en Vercel |
| **Institucional** | **Angular · .NET/C# · SQL Server** | [`vip-web/`](vip-web/) + [`dotnet/`](dotnet/) | Objetivo productivo (MA-02 §9.1.1.3.1 y §10.2) |

La versión institucional replica la lógica del piloto **capa por capa con pruebas
de paridad** (mismos casos de UWI, validación, ETL/DANE, ingesta Excel). Estado
verificado: **`dotnet test` 53/53** y **`ng test` 19/19**.

### Integraciones OTI

| Integración | Estado | Evidencia |
|---|---|---|
| **SQL Server** | ✅ Verificado en motor real | Migración `InitialCreate` aplicada a **SQL Server 2022** (10 tablas en `[vip]`); round-trip `POST/GET` persistido y confirmado con `sqlcmd`. |
| **SMTP** (correo de aplicación) | ✅ Transmisión real verificada | Al aplicar un cuaderno, `SmtpEmailSender` emitió un SMTP real capturado por un catcher local (`vip@anh.gov.co → inventariopozos@anh.gov.co`). |
| **Entra ID + MFA** | ✅ Cableado · ⛔ tenant real pendiente | API: JWT Bearer + validación **fail-closed** (probada). SPA: **MSAL** (login redirect, guard, interceptor). Script de registro listo; falta ejecutarlo contra el tenant de la OTI. |

Detalle y runbook: [`dotnet/docs/OTI-INTEGRACION.md`](dotnet/docs/OTI-INTEGRACION.md)
· registro Entra: [`dotnet/docs/ENTRA-APP-REGISTRATION.md`](dotnet/docs/ENTRA-APP-REGISTRATION.md)
· subproyectos: [`dotnet/README.md`](dotnet/README.md), [`vip-web/README.md`](vip-web/README.md).

> Lo único pendiente de infraestructura es **ejecutar el registro de app y validar
> un token contra el tenant Entra real** de la OTI (no disponible en el entorno de
> desarrollo). El resto de integraciones quedó verificado sobre motores reales.

---

## Arquitectura del sistema

Una sola aplicación **Next.js full-stack**: el frontend (React) y el backend (API Routes) viven en el mismo proceso. No hay microservicios, colas de mensajes ni servicios externos; la persistencia es un archivo SQLite local.

### Vista de capas

```mermaid
flowchart TB
  subgraph Cliente["🖥️  Cliente (navegador)"]
    UI["Páginas React<br/>/ · /panel · /calidad · /analitica"]
    CTX["Contextos<br/>AuthContext · AppPreferences (tema, ES/EN)"]
  end

  subgraph Edge["🛡️  Borde"]
    MW["src/middleware.ts<br/>Verifica cookie anh_session<br/>Deja pasar rutas públicas"]
  end

  subgraph App["⚙️  Next.js 16 — App Router (Node.js)"]
    Pages["app/**/page.tsx<br/>Server + Client Components"]
    API["app/api/**/route.ts<br/>Handlers REST"]
  end

  subgraph Dominio["🧠  Capa de dominio — src/lib (SQL directo, sin ORM)"]
    Auth["auth · auth-db · auth-scope<br/>sesión, usuarios, alcance por rol"]
    DB["db · notebook-db<br/>pozos, cargues, cuadernos, eventos"]
    VAL["validation · validation-findings<br/>etl · uwi<br/>reglas + UWI fiscalizado"]
    XLSX["xlsx (lectura)<br/>notebook-template + ExcelJS (generación)<br/>export-calidad / export-upload"]
    MAIL["mail<br/>outbox simulado"]
  end

  subgraph Datos["💾  Persistencia y recursos"]
    SQLite[("SQLite<br/>data/inventario.db<br/>(o /tmp en Vercel)")]
    Seed["data/seed.json<br/>~70 pozos + catálogos DANE"]
    Outbox["data/outbox/<br/>correo + Excel simulados"]
    Geo["public/geo/<br/>GeoJSON Colombia"]
  end

  UI --> MW --> Pages
  UI -->|fetch| MW --> API
  CTX --> UI
  Pages --> API
  API --> Auth & DB & VAL & XLSX & MAIL
  Auth --> SQLite
  DB --> SQLite
  DB --> Seed
  VAL --> DB
  MAIL --> Outbox
  Pages --> Geo
```

> **Regla de oro del diseño:** toda la lógica de negocio vive en `src/lib`. Las páginas y los `route.ts` son capas delgadas que autentican, delegan al dominio y serializan la respuesta.

### Ciclo de una petición

```mermaid
sequenceDiagram
  participant B as Navegador
  participant MW as middleware.ts
  participant R as route.ts (API)
  participant S as auth-scope.ts
  participant L as src/lib (dominio)
  participant DB as SQLite

  B->>MW: HTTP + cookie anh_session
  alt Ruta pública
    MW-->>R: continúa sin sesión
  else Ruta protegida
    MW->>MW: valida firma HMAC de la cookie
    MW-->>B: 401 / redirect a /login (si inválida)
    MW->>R: continúa (si válida)
  end
  R->>S: requireSession() + requireRole()
  S-->>R: usuario y rol (o 401/403)
  R->>L: llamada de dominio (validar, guardar, generar…)
  L->>DB: SQL (better-sqlite3, síncrono)
  DB-->>L: filas
  L-->>R: resultado tipado
  R-->>B: JSON o archivo (.xlsx / .pdf)
```

### Módulos principales

| Módulo | Ubicación | Responsabilidad |
|--------|-----------|-----------------|
| **Autenticación** | `auth.ts`, `auth-db.ts`, `auth-scope.ts` | Sesión por cookie firmada (HMAC), usuarios, `audit_log`, alcance de datos por rol |
| **Pozos y cargues** | `db.ts` | CRUD de pozos, lotes (`uploads`), informes de validación, filtros del panel, códigos DANE |
| **Cuadernos** | `notebook-db.ts` | Ciclo de vida del cuaderno, versiones, timeline de eventos |
| **Validación** | `validation.ts` | Reglas de negocio por pozo; catálogos desde `seed.json` |
| **ETL / normalización** | `etl.ts` | Reparación de codificación, canonización de departamento/municipio, códigos DANE |
| **Hallazgos** | `validation-findings.ts` | Conteo y filtrado de issues (error / warning / info) |
| **UWI** | `uwi.ts` | Generación y validación según instructivo abril 2026 |
| **Plantilla** | `notebook-template.ts`, `template-columns.ts` | Genera la plantilla `.xlsx` con selectores; define columnas compartidas con el parser |
| **Excel (export)** | `export-calidad.ts`, `export-upload.ts` | Informes de calidad y de versión en Excel |
| **Analítica** | `analytics.ts`, `analytics-db.ts` | Temas, radar comparativo, entidades |
| **Correo** | `mail.ts` | Paquete simulado en `data/outbox/` al aplicar envío |
| **UI cuaderno** | `NotebookInventory.tsx`, `NotebookWorkspace.tsx` | Inventario de cuadernos y workspace con trazabilidad |
| **i18n** | `i18n/messages/es.ts`, `en.ts` | Traducciones; locale en `localStorage` |

---

## Recorrido funcional de extremo a extremo

Vista única del camino feliz, desde que la operadora inicia hasta que la ANH consulta el dato validado.

```mermaid
flowchart LR
  subgraph OP["👷 Operadora"]
    A1["Crear cuaderno<br/>+ nº de pozos"]
    A2["Descargar<br/>plantilla .xlsx"]
    A3["Diligenciar<br/>en Excel"]
    A4["Cargar versión"]
    A5{"¿0 pozos<br/>inválidos?"}
    A6["Aplicar<br/>envío a ANH"]
  end
  subgraph SYS["⚙️ Sistema"]
    B1["Validación<br/>determinista"]
    B2["Paquete en<br/>data/outbox/"]
  end
  subgraph ANH["🏛️ ANH"]
    C1["Panel<br/>(inventario validado)"]
    C2["Analítica<br/>comparativa"]
  end

  A1 --> A2 --> A3 --> A4 --> B1 --> A5
  A5 -->|No: corregir| A3
  A5 -->|Sí| A6 --> B2 --> C1 --> C2
```

---

## Plantilla descargable del cuaderno

Para que la operadora **no tenga que adivinar el formato**, el sistema genera bajo demanda una plantilla Excel lista para diligenciar. Es el mismo archivo que luego se vuelve a cargar: descargar → diligenciar → cargar.

```mermaid
sequenceDiagram
  actor Op as Operadora
  participant UI as Crear cuaderno / NotebookWorkspace
  participant API as GET /api/notebooks/template?rows=N
  participant GEN as notebook-template.ts (ExcelJS)
  participant CAT as getCatalogs() (seed.json)

  Op->>UI: Indica «¿cuántos pozos?» (N)
  Op->>UI: Clic «Descargar plantilla (N pozos)»
  UI->>API: rows=N (+ operadora si admin)
  API->>GEN: buildNotebookTemplate({ rows, operadora })
  GEN->>CAT: Opciones de cada catálogo
  GEN-->>API: .xlsx (hojas INVENTARIO · Listas · Instrucciones)
  API-->>Op: Descarga del archivo
  Note over Op: Diligencia en Excel y vuelve a cargar<br/>(mismo archivo, parser lo reconoce)
```

**Qué contiene el archivo generado** (`notebook-template.ts`):

| Hoja | Contenido |
|------|-----------|
| **INVENTARIO** | Encabezados oficiales del formato ANH y **N filas** listas para diligenciar. Operadora **prellenada**. |
| **Listas** (oculta) | Una columna por catálogo; las celdas de INVENTARIO referencian estos rangos como **listas desplegables**. |
| **Instrucciones** | Cómo diligenciar, campos obligatorios y que los códigos DANE / UWI se calculan al cargar. |

- **Selectores (data validation):** 14 columnas de catálogo (estado del pozo, tipo de pozo, operadora, contrato, campo AVM, departamento, municipio, formaciones…) se despliegan desde la hoja `Listas`.
- **Obligatorios:** resaltados en naranja + nota «Campo obligatorio». No se marca con `*` en el encabezado, porque el texto del encabezado es la **llave que usa el parser** para mapear cada columna a su atributo.
- **Columnas compartidas:** `template-columns.ts` define las columnas una sola vez y las usan tanto el **generador** como el **parser de carga**. Las 29 columnas ya mapeadas reutilizan los encabezados oficiales; las 10 columnas especiales (coordenadas e inyección) usan encabezados limpios registrados en `TEMPLATE_SPECIAL_COLUMN_MAP`, de modo que la plantilla **hace round-trip** al recargarse.
- **Municipio:** lista completa del catálogo DANE (sin cascada dependiente del departamento) por robustez en Excel; la validación al cargar corrige lo que no coincida.

Puntos de descarga (misma función en dos lugares):

- **Al crear el cuaderno** — campo «¿Cuántos pozos va a registrar?» + botón «Descargar plantilla (N pozos)».
- **En la página del cuaderno** (`/calidad/[id]`) — bloque «¿No tiene el archivo? Descargue la plantilla», justo encima de la zona de carga.

---

## Flujo de carga Excel y validación

Cada fila del Excel se valida de forma **determinista**: los conteos no son inventados; provienen de `validateWell()` y se persisten en `validation_issues`.

```mermaid
sequenceDiagram
  actor Op as Operadora / Admin
  participant UI as NotebookWorkspace
  participant API as POST /api/notebooks/[id]/upload
  participant SEC as upload-security.ts
  participant XLS as xlsx (parser)
  participant ETL as etl.ts (normaliza)
  participant DB as addNotebookVersion()
  participant VAL as validateWell()
  participant SQL as SQLite

  Op->>UI: Selecciona archivo .xlsx
  UI->>API: multipart/form-data (file)
  API->>SEC: validateExcelUpload() (tipo, tamaño)
  API->>XLS: Lee hoja INVENTARIO
  XLS->>API: filas crudas → parseExcelRow()
  API->>ETL: normaliza depto/municipio + códigos DANE
  API->>DB: addNotebookVersion(records)
  loop Por cada pozo
    DB->>VAL: validateWell(record)
    VAL-->>DB: ValidationResult + issues
    DB->>SQL: INSERT wells + validation_issues
  end
  DB->>SQL: UPDATE uploads (totales + error/warning/info_issues)
  DB->>SQL: INSERT notebook_events (upload)
  API-->>UI: version, summary, results
  UI->>UI: Actualiza timeline y detalle de hallazgos
```

### Estados de un pozo tras validar

| `validation_status` | Condición |
|---------------------|-----------|
| `invalid` | Al menos un hallazgo con severidad `error` |
| `warning` | Sin errores, pero con advertencias |
| `valid` | Sin errores ni advertencias |

### Severidades de hallazgo

| Severidad | Efecto en el pozo | Bloquea aplicar envío |
|-----------|-------------------|------------------------|
| `error` | Pozos inválidos (`invalid_records`) | **Sí** — la versión activa debe tener 0 pozos inválidos |
| `warning` | Pozos con advertencias | No |
| `info` | Informativo (p. ej. diferencia UWI SGC vs fiscalizado) | No |

---

## Cuadernos de inventario (versiones y trazabilidad)

Un **cuaderno** agrupa el ejercicio de inventario de una operadora. Cada carga Excel genera una **versión numerada** (`uploads.version_number`) en estado `draft` hasta que se aplica el envío.

```mermaid
stateDiagram-v2
  [*] --> active: Crear cuaderno
  active --> active: Cargar versión N (draft)
  active --> submitted: Aplicar envío (0 pozos inválidos)
  submitted --> archived: Crear nuevo cuaderno activo
  active --> archived: Crear nuevo cuaderno activo

  note right of active
    notebooks.status = active
    uploads.status = draft
    Solo un cuaderno activo por operadora
  end note

  note right of submitted
    uploads.status = submitted
    Visible en panel ANH / operadora
    Excel en data/outbox/
  end note
```

```mermaid
flowchart LR
  subgraph Cuaderno["Cuaderno activo (/calidad/[id])"]
    T["Plantilla<br/>GET /api/notebooks/template"]
    V1["Versión 1<br/>upload draft"]
    V2["Versión 2<br/>upload draft"]
    TL["Timeline<br/>notebook_events"]
    HF["Detalle hallazgos<br/>filtrado por uploadId"]
  end

  T -.->|diligenciar y cargar| V1
  V1 -.-> TL
  V2 --> TL
  V2 --> HF
  HF --> API2["GET /api/validations?uploadId="]
  V2 -->|versión activa sin pozos inválidos| SUB["POST .../submit"]
  SUB --> Panel["Panel /panel<br/>pozos submitted"]
```

### Eventos de trazabilidad (`notebook_events`)

| `event_type` | Cuándo se registra |
|--------------|-------------------|
| `created` | Creación del cuaderno |
| `upload` | Cada carga Excel (metadata con totales y conteos de hallazgos) |
| `submit` | Aplicación del inventario a la ANH |
| `archived` | Archivo al abrir un cuaderno nuevo |

Solo puede haber **un cuaderno activo** por operadora. Al crear uno nuevo, el anterior pasa a **archivado** y permanece en el inventario histórico.

### Cuaderno demo automático

Para la operadora demo (`DEMO_OPERADORA`), `ensureDemoNotebook()` crea en la primera instancia un cuaderno **«Cuaderno demo — inventario de prueba»** con 2 pozos sintéticos que igualmente pasan por `validateWell()`. Las cargas reales del usuario son independientes y generan versiones adicionales.

---

## Autenticación, roles y rutas

```mermaid
flowchart TD
  REQ["Petición HTTP"] --> PUB{"¿Ruta pública?"}
  PUB -->|Sí| OK["Continuar sin sesión"]
  PUB -->|No| COOKIE{"¿Cookie anh_session válida?"}
  COOKIE -->|No, API| API401["401 JSON"]
  COOKIE -->|No, página| REDIR["Redirige a /login?next="]
  COOKIE -->|Sí| HANDLER["Handler API / página"]
  HANDLER --> ROLE{"requireRole en API"}
  ROLE -->|Sin permiso| DENY["403 No autorizado"]
  ROLE -->|OK| SCOPE["Alcance de datos<br/>filtra por operadora / estado submitted"]
```

### Rutas públicas (sin sesión)

Definidas en `src/middleware.ts`:

- `/` — landing
- `/login`
- `/api/auth/login`
- `/api/catalogs`
- `/api/public/landing-stats`

Todo lo demás exige cookie de sesión.

### Navegación por rol

Definida en `src/lib/navigation.ts`:

| Rol | Menú lateral |
|-----|--------------|
| **operadora** | Panel · Cuaderno |
| **anh** | Panel · Analítica |
| **admin** | Panel · Cuaderno · Analítica · Usuarios |

### Alcance de datos en el panel

Implementado en `buildScopeClause()` (`db.ts`):

| Rol | Pozos visibles |
|-----|----------------|
| **admin** | Todos |
| **operadora** | Solo su operadora; uploads `submitted` o `seed` (borradores no aparecen en panel) |
| **anh** | Uploads `submitted`, `seed` o `processed`; solo pozos `valid` o `warning` |

### Páginas y redirecciones

| Ruta | Descripción |
|------|-------------|
| `/` | Landing institucional: hero con estadísticas reales, capacidades interactivas, flujo GOP y portales por rol. **Sesión activa:** no redirige a `/panel`; el logo del sidebar vuelve aquí sin cerrar sesión |
| `/login` | Inicio de sesión |
| `/panel` | Dashboard principal (mapa, KPIs, Sankey, tabla) |
| `/calidad` | Inventario de cuadernos |
| `/calidad/[id]` | Workspace: descarga de plantilla, versiones, trazabilidad, hallazgos, cargue |
| `/analitica` | Analítica comparativa (ANH y admin) |
| `/admin/usuarios` | CRUD de usuarios (admin) |
| `/registrar` | Formulario manual de un pozo (validación en línea) |
| `/cargar` | Redirige a `/calidad` |
| `/pozos` | Redirige a `/panel` |
| `/operadoras` | Redirige a `/panel` |

---

## Modelo de datos

```mermaid
erDiagram
  notebooks ||--o{ uploads : "versiones"
  notebooks ||--o{ notebook_events : "trazabilidad"
  uploads ||--o{ wells : "contiene"
  wells ||--o{ validation_issues : "hallazgos"
  users ||--o{ audit_log : "acciones"

  notebooks {
    int id PK
    string operadora
    string title
    string status "active|submitted|archived"
    int active_version_id FK
    int submitted_version_id FK
    datetime submitted_at
    string submitted_by
  }

  uploads {
    int id PK
    string filename
    string operadora
    int notebook_id FK
    int version_number
    int total_records
    int valid_records
    int invalid_records
    int warning_records
    int error_issues
    int warning_issues
    int info_issues
    string status "draft|submitted|processed|seed"
  }

  wells {
    int id PK
    int upload_id FK
    string nombre_pozo_sgc
    string operadora
    string uwi_fiscalizado
    string validation_status "valid|warning|invalid"
  }

  validation_issues {
    int id PK
    int well_id FK
    string field
    string severity "error|warning|info"
    string message
    string rule
  }

  notebook_events {
    int id PK
    int notebook_id FK
    string event_type
    int upload_id FK
    string metadata_json
    datetime created_at
  }

  users {
    int id PK
    string email UK
    string role "operadora|anh|admin"
    string operadora
    string password_hash
  }
```

### Tablas auxiliares

| Tabla | Uso |
|-------|-----|
| `audit_log` | Trazabilidad de acciones admin (edición/eliminación de pozos, envíos) |
| `users` | Credenciales locales (demo); semilla admin en primer arranque |

### Migraciones incrementales

El esquema evoluciona con `ensureColumn()` y `CREATE TABLE IF NOT EXISTS` al iniciar (`db.ts`, `notebook-db.ts`, `auth-db.ts`). No hay migraciones versionadas externas.

---

## Roles y permisos

| Rol | Menú | Alcance de datos | Acciones clave |
|-----|------|------------------|----------------|
| **Operadora** | Panel · Cuaderno | Solo su operadora; panel sin borradores | Crear cuaderno, descargar plantilla, cargar Excel, corregir, aplicar envío |
| **ANH** | Panel · Analítica | Inventario consolidado validado | Consulta, analítica comparativa, export PDF |
| **Admin** | Panel · Cuaderno · Analítica · Usuarios | Acceso completo | Todo lo anterior + CRUD usuarios + cuadernos por operadora |

---

## Flujos por rol

### Operadora

```
Crear cuaderno → Descargar plantilla → Diligenciar → Cargar (versiones) → Corregir → Aplicar a ANH
```

- Rutas: `/calidad` (listado) y `/calidad/[id]` (trabajo).
- Cada carga genera versión numerada con timeline clicable.
- La trazabilidad y el detalle de hallazgos comparten conteos de **hallazgos** (`error_issues`, `warning_issues`, `info_issues`).
- Solo la **versión activa** sin pozos inválidos puede aplicarse (`invalid_records === 0`).

### ANH

```
Panel (inventario validado) → Analítica (comparar vs promedio nacional)
```

- El panel no expone re-validación de borradores.
- Analítica: comparar operadora, departamento, municipio o pozo frente al promedio nacional.

### Admin

- Mismo flujo de cuaderno que operadora, con selector de operadora remitente.
- CRUD de usuarios en `/admin/usuarios`.
- Edición/eliminación de pozos con registro en `audit_log`.

---

## Validación y UWI fiscalizado

Motor en `src/lib/validation.ts`. Reglas activas (~59 comprobaciones según `getActiveValidationRuleCount()`):

| Categoría | Ejemplos |
|-----------|----------|
| **Obligatorios** | Operadora, contrato, campo AVM, nombre pozo SGC, estado, departamento, municipio |
| **Catálogos** | Listas oficiales en `data/seed.json` (operadoras, contratos, formaciones, tipos de pozo, etc.) |
| **Departamento DANE** | Validación canónica vía `isCanonicalDepartamento()` |
| **Condicionales** | Campos AVM si «SE MANTIENE» / «MODIFIC»; sistema de levantamiento si productor |
| **Numéricos** | Producción e inyección acumulada |
| **Coordenadas** | Planas (Bogotá, nacional) y geográficas (lat/long) |
| **UWI fiscalizado** | Generación automática + reglas del instructivo (`uwi.ts`) |
| **Consistencia** | Comparación UWI SGC vs fiscalizado (severidad `info`) |

**Estructura UWI fiscalizado:**

```
[Depto 2][Municipio 3][Sigla 4][Número 4][Clúster][Ángulo][Trayectoria][Objetivo]-[Terminación]
```

Referencia: *INSTRUCTIVO UWI 16 DE ABRIL DE 2026*.

Informes exportables en Excel desde el cuaderno (`/api/validations/export`).

---

## Conteos: pozos vs hallazgos

Es importante distinguir dos niveles de conteo:

| Métrica | Nivel | Campo / función | Uso |
|---------|-------|-----------------|-----|
| Pozos totales | Pozo | `total_records` | Resumen de versión |
| Pozos válidos | Pozo | `valid_records` | Timeline (totales), resumen de versión |
| Pozos inválidos | Pozo | `invalid_records` | Bloqueo de «Aplicar envío» |
| Hallazgos error | Issue | `error_issues` / `countIssues()` | Timeline, chips de versión, detalle de hallazgos |
| Hallazgos advertencia | Issue | `warning_issues` + `info_issues` | Timeline, filtros warning |

Un pozo inválido puede tener **varios** hallazgos `error`. La trazabilidad y el panel de hallazgos muestran conteos de **hallazgos**; el requisito para aplicar sigue siendo **cero pozos inválidos**.

---

## Panel y analítica

### Panel (`/panel`)

- Mapa territorial de Colombia (Leaflet + GeoJSON).
- Filtros cruzados: pozo, operadora, departamento, estado, validación.
- KPIs, gráficos (estado, departamento, operadoras), diagrama Sankey, tabla de pozos.
- Exportación de informe PDF (`dashboard-report-pdf.ts`).

### Analítica (`/analitica`) — ANH y admin

| Tema | Métricas |
|------|----------|
| **Producción** | Días productivos, petróleo, agua, gas |
| **Inyección** | Días, agua, gas, otros fluidos |
| **Perfil operativo** | % activos, horizontales, productores, inyectores, coordenadas, UWI |
| **Portafolio** | Pozos por operadora, cobertura territorial, contratos |

Visualizaciones: radar comparativo (base = 100 nacional), barras de delta, nube de producción, mapas térmicos.

---

## Landing pública

La ruta `/` es pública (`src/middleware.ts`) y funciona como vitrina institucional del VIP. Componentes principales:

| Componente | Archivo | Comportamiento |
|------------|---------|----------------|
| **Hero + estadísticas** | `src/app/page.tsx` | KPIs desde `GET /api/public/landing-stats` (pozos, operadoras, reglas). Usuario autenticado ve «Ir al panel» en lugar de «Iniciar sesión» |
| **Capacidades** | `LandingCapabilities.tsx` | Pestañas laterales con panel detallado; **rotación automática cada 3 s** con barra de progreso; se detiene si el usuario hace clic en una pestaña |
| **Flujo GOP** | `page.tsx` | Tres pasos del ciclo institucional (carga → validación → envío) |
| **Portales por rol** | `LandingRoles.tsx` | Banda oscura con dos paneles interactivos (Operadora / Funcionario ANH), puente animado operadora→ANH, chips de capacidades y CTA a `/login?role=` o al panel si hay sesión |

Navegación con sesión activa: el logo ANH en `AppSidebar` y el header móvil (`AppShell`) enlazan a `/` **sin cerrar sesión**.

---

## Inicio rápido

### Requisitos

- **Node.js** 20+
- **npm** 9+
- macOS / Linux / Windows

### Instalación

```bash
git clone https://github.com/PhDRedondo/Inventario-de-pozos.git
cd Inventario-de-pozos
npm install
```

Crear `.env.local` (ver [Variables de entorno](#variables-de-entorno)) y arrancar:

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Datos iniciales

Al primer arranque, si la base está vacía:

1. Se cargan **~70 registros de semilla** desde `data/seed.json` (formato oficial ANH, catálogos DANE).
2. Se crean usuarios demo en `users` (`auth-db.ts`).
3. Para la operadora demo, se crea el cuaderno de prueba (`ensureDemoNotebook()`).

La base SQLite se crea en `data/inventario.db` (ignorada por git).

### Build de producción local

```bash
npm run build
npm start
```

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `SESSION_SECRET` | Sí (prod, ≥32) | Secreto HMAC de la cookie `anh_session` |
| `ANH_ADMIN_PASSWORD` | Sí (prod, ≥10) | Contraseña inicial del admin semilla |
| `DEMO_LOGIN_ENABLED` | No | `false` en prod/mesa OTI; en desarrollo habilitado por defecto |
| `DEMO_PASSWORD` | Si demo en prod | Contraseña de usuarios demo (nunca en el cliente) |
| `VERCEL` | Auto | Detectada por Vercel; activa rutas `/tmp` para SQLite y outbox |

Ver plantilla: [`.env.example`](.env.example).

Ejemplo `.env.local` (desarrollo):

```env
SESSION_SECRET=local-dev-only-session-secret-min-32chars!
ANH_ADMIN_PASSWORD=local-dev-admin-change-me
DEMO_LOGIN_ENABLED=true
DEMO_PASSWORD=local-demo-password
```

---

## Despliegue en Vercel

El proyecto incluye `vercel.json` y rutas de datos compatibles con serverless (`src/lib/paths.ts` usa `/tmp/inventario-pozos-anh-data` cuando `VERCEL=1`).

### Opción 1 — Dashboard (recomendada)

1. Importar [PhDRedondo/Inventario-de-pozos](https://github.com/PhDRedondo/Inventario-de-pozos) en [vercel.com/new](https://vercel.com/new).
2. Framework: **Next.js** (detección automática).
3. Agregar variables: `SESSION_SECRET`, `ANH_ADMIN_PASSWORD`, y `DEMO_LOGIN_ENABLED=false`.
4. Deploy.

### Opción 2 — CLI

```bash
npm i -g vercel
vercel login
./scripts/vercel-deploy.sh
```

```mermaid
flowchart LR
  subgraph Vercel["Vercel Serverless"]
    FN["Next.js Function"]
    TMP[("/tmp/inventario-pozos-anh-data<br/>inventario.db · outbox/")]
  end
  FN --> TMP
  Note["SQLite efímero:<br/>se reinicia por instancia"]
  TMP -.-> Note
```

> **Nota:** En Vercel la base SQLite es **efímera**. Adecuado para **demo institucional**; para producción persistente se recomienda PostgreSQL, Turso, PlanetScale u otra base gestionada.

---

## Estructura del proyecto

```
inventario-pozos-anh/
├── docs/                          # Documentación institucional (HTML autocontenido)
│   ├── guia-produccion-anh.html   #   Plan de puesta en producción
│   ├── presentacion-general-vip.html
│   ├── revision-cumplimiento-anh-gtic.html
│   └── ... (analítica, IA/ML, hardening OTI)
├── data/
│   ├── seed.json                  # ~70 pozos + catálogos oficiales (DANE)
│   ├── inventario.db              # Generada localmente (gitignored)
│   └── outbox/                    # Correos y Excel simulados al aplicar envío
├── public/
│   ├── geo/                       # GeoJSON departamentos y municipios
│   └── anh-logo.*                 # Identidad visual ANH
├── scripts/
│   ├── github-setup.sh
│   ├── vercel-deploy.sh
│   └── test-uwi.ts
├── src/
│   ├── middleware.ts              # Verificación de sesión + rutas públicas
│   ├── app/                       # App Router
│   │   ├── page.tsx               # Landing pública
│   │   ├── login/
│   │   ├── panel/                 # Dashboard principal
│   │   ├── calidad/               # Inventario de cuadernos
│   │   ├── calidad/[id]/          # Workspace del cuaderno
│   │   ├── analitica/             # Analítica global
│   │   ├── admin/usuarios/        # Administración de usuarios
│   │   ├── registrar/             # Alta manual de pozo
│   │   └── api/                   # REST (ver tabla API)
│   ├── components/
│   │   ├── NotebookWorkspace.tsx      # Cuaderno: plantilla, versiones, timeline, hallazgos
│   │   ├── NotebookInventory.tsx      # Listado + crear cuaderno + descargar plantilla
│   │   ├── LandingCapabilities.tsx    # Landing: pestañas de capacidades (auto 3 s)
│   │   ├── LandingRoles.tsx           # Landing: portales operadora / ANH
│   │   ├── WellsMap.tsx · WellsSankeyChart.tsx
│   │   └── AppShell.tsx · AppSidebar.tsx
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── AppPreferences.tsx         # Tema + i18n
│   ├── hooks/
│   ├── i18n/
│   │   └── messages/es.ts · en.ts
│   └── lib/
│       ├── attributes.ts          # Atributos del formato + columnas especiales
│       ├── catalogs.ts            # Temas, campos y mapa de columnas Excel
│       ├── template-columns.ts    # Columnas de la plantilla (compartidas con el parser)
│       ├── notebook-template.ts   # Generación de la plantilla .xlsx (ExcelJS)
│       ├── db.ts                  # SQLite, pozos, uploads, panel, DANE
│       ├── notebook-db.ts         # Cuadernos, versiones, eventos
│       ├── validation.ts          # Reglas de validación
│       ├── validation-findings.ts # Conteo/filtrado de hallazgos
│       ├── etl.ts                 # Normalización geográfica y de codificación
│       ├── uwi.ts                 # UWI fiscalizado
│       ├── export-calidad.ts · export-upload.ts
│       ├── analytics.ts · analytics-db.ts
│       ├── auth.ts · auth-db.ts · auth-scope.ts
│       ├── mail.ts                # Outbox simulado
│       └── paths.ts               # data/ vs /tmp
├── vercel.json
└── package.json
```

---

## API principal

Todas las rutas sensibles validan sesión (`requireSession`) y rol (`requireRole`) vía `auth-scope.ts`.

### Autenticación

| Endpoint | Método | Roles | Descripción |
|----------|--------|-------|-------------|
| `/api/auth/login` | POST | Público | Inicio de sesión |
| `/api/auth/logout` | POST | Autenticado | Cerrar sesión |
| `/api/auth/me` | GET | Autenticado | Usuario actual |
| `/api/auth/config` | GET | Público | Config de login (demo habilitado, etc.) |

### Cuadernos e inventario

| Endpoint | Método | Roles | Descripción |
|----------|--------|-------|-------------|
| `/api/notebooks` | GET | operadora, admin | Listar cuadernos |
| `/api/notebooks` | POST | operadora, admin | Crear cuaderno |
| `/api/notebooks/template` | GET | operadora, admin | **Descargar plantilla `.xlsx`** (`?rows=N`, con selectores) |
| `/api/notebooks/[id]` | GET | operadora, admin | Detalle, versiones, eventos |
| `/api/notebooks/[id]/upload` | POST | operadora, admin | Cargar Excel (multipart) |
| `/api/notebooks/[id]/submit` | POST | operadora, admin | Aplicar inventario a ANH |
| `/api/notebooks/active` | GET | operadora, admin | Cuaderno activo (compat.) |
| `/api/notebooks/active/upload` | POST | operadora, admin | Carga al activo (compat.) |
| `/api/notebooks/active/submit` | POST | operadora, admin | Envío del activo (compat.) |

### Validación y pozos

| Endpoint | Método | Roles | Descripción |
|----------|--------|-------|-------------|
| `/api/validations` | GET | operadora, admin, anh* | Hallazgos por `uploadId` |
| `/api/validations/export` | GET | operadora, admin | Export Excel de calidad |
| `/api/wells` | GET/POST | Según scope | Listado / alta manual |
| `/api/wells/[id]` | GET/PATCH/DELETE | admin | Detalle y edición |
| `/api/wells/map` | GET | Autenticado | Puntos para mapa |
| `/api/wells/map-image` | GET | Autenticado | Imagen del mapa (informes) |
| `/api/upload` | POST | Legacy | Carga directa |
| `/api/uploads/[id]/submit` | POST | Legacy | Envío |
| `/api/uploads/latest` | GET | Autenticado | Último cargue |
| `/api/uwi/preview` | POST | Autenticado | Vista previa UWI |

\* Rol ANH: solo uploads `submitted`/`processed` y pozos `valid`/`warning`.

### Panel y analítica

| Endpoint | Método | Roles | Descripción |
|----------|--------|-------|-------------|
| `/api/stats` | GET | Autenticado | KPIs del panel (scope por rol) |
| `/api/analytics` | GET | anh, admin | Indicadores y radar |
| `/api/analytics/entities` | GET | anh, admin | Autocompletado de entidades |
| `/api/public/landing-stats` | GET | Público | Estadísticas hero landing |
| `/api/catalogs` | GET | Público | Catálogos para formularios |
| `/api/operadoras` | GET | Autenticado | Resumen por operadora |

### Administración

| Endpoint | Método | Roles | Descripción |
|----------|--------|-------|-------------|
| `/api/admin/users` | GET/POST | admin | Listar / crear usuarios |
| `/api/admin/users/[id]` | PATCH/DELETE | admin | Actualizar / desactivar |
| `/api/admin/audit` | GET | admin | Registro de auditoría |

---

## Desarrollo y convenciones

### Stack y patrones

- **App Router** de Next.js: páginas en `src/app/`, lógica de negocio en `src/lib/` (sin capa ORM; SQL directo con `better-sqlite3`).
- **Componentes cliente** (`"use client"`) para interactividad; datos iniciales vía `fetch` a API routes.
- **i18n**: claves en `i18n/messages/`; usar `useT()` en componentes; español por defecto.
- **Atributos del inventario**: siempre referenciar etiquetas vía `getAttributeLabel()` / `attributes.ts`. La plantilla y el parser comparten `template-columns.ts` para no desincronizarse.

> ⚠️ **Nota del repo (`AGENTS.md`):** esta versión de Next.js puede traer cambios de API respecto a lo conocido. Consulta las guías en `node_modules/next/dist/docs/` antes de escribir código nuevo.

### Estilo de commits (observado en el repo)

Mensajes en inglés, imperativo, enfocados en el *porqué*:

```
Add downloadable notebook template with dropdowns and well-count flow.
Align notebook traceability counts with validation findings.
Scope notebook findings to the selected upload version.
```

### Pruebas locales útiles

```bash
npm run lint          # ESLint
npm run test:uwi      # Generación UWI (scripts/test-uwi.ts)
npm run build         # Verificar TypeScript + build Next.js
```

### Tour guiado

La UI incluye tour con `driver.js` (`lib/guided-tour.ts`) en panel y cuaderno.

---

## Acceso demo

El ingreso demo **no envía contraseñas al navegador**: el cliente pide `{ demo: true }` y el servidor resuelve credenciales solo si `DEMO_LOGIN_ENABLED` lo permite.

En el piloto la contraseña es fija y visible en `/login`. Elija el rol y pulse **Ingresar** (no hay que escribirla):

| Perfil | Usuario | Contraseña |
|--------|---------|------------|
| **Admin** | `johan.redondo@anh.gov.co` | `Anh2026!` |
| **ANH** | `funcionario` | `Anh2026!` |
| **Operadora** | `demo` | `Anh2026!` |

Operadora demo (campo completo):

```
AMERISUR EXPLORACIÓN COLOMBIA ANDES OPERATING COMPANY LLC SUCURSAL COLOMBIA
```

Documentación: [`docs/presentacion-general-vip.html`](docs/presentacion-general-vip.html) · [`docs/hardening-pre-oti.html`](docs/hardening-pre-oti.html).

---

## Scripts útiles

```bash
npm run dev          # Servidor de desarrollo (puerto 3000)
npm run build        # Build de producción
npm run start        # Servidor producción local
npm run lint         # ESLint
npm run test:uwi     # Pruebas generación UWI
```

---

## Guía de puesta en producción ANH

Documento HTML autocontenido para equipos de TI, GOP y seguridad de la ANH:

**[`docs/guia-produccion-anh.html`](docs/guia-produccion-anh.html)** — abrir en el navegador.

Incluye:

- Bloqueadores actuales del modo demo (SQLite efímero en Vercel, auth local, correo simulado, repositorio personal)
- Arquitectura objetivo (BD persistente, SSO, SMTP, GitHub ANH, dominio `*.anh.gov.co`)
- Roadmap por fases: gobernanza → migración repo → PostgreSQL → staging → SSO → correo → go-live
- Checklist maestro, riesgos, variables de entorno y estimación de esfuerzo

> Complementa las secciones [Despliegue en Vercel](#despliegue-en-vercel) y [Limitaciones](#limitaciones-y-próximos-pasos) con el plan institucional completo.

---

## Limitaciones y próximos pasos

Las filas marcadas **✅ (institucional)** ya están resueltas en el stack
Angular · .NET · SQL Server (ver [Migración al stack institucional](#migración-al-stack-institucional-anh-gtic-ma-02));
lo indicado aplica al **piloto** Next.js/SQLite de este README.

| Área | Estado (piloto) | Resuelto en el stack institucional |
|------|-----------------|------------------------------------|
| **Persistencia Vercel** | SQLite en `/tmp`, no durable | ✅ SQL Server 2022 (migración EF Core aplicada y verificada) |
| **Correo** | Simulado en `data/outbox/` | ✅ SMTP real (verificado con catcher local) |
| **Autenticación** | Usuarios locales (demo) | ✅ Entra ID + MFA (API fail-closed; SPA con MSAL) · ⛔ falta tenant real |
| **Migraciones DB** | `ensureColumn` ad hoc | ✅ Migraciones EF Core versionadas |
| **Plantilla — cascada municipio** | Lista completa sin dependencia del departamento | Listas dependientes (INDIRECT) si se requiere |
| **Producción institucional** | Demo en Vercel + repo personal | Ver [`docs/guia-produccion-anh.html`](docs/guia-produccion-anh.html) |

---

## Licencia y uso

Proyecto de **uso institucional** — Agencia Nacional de Hidrocarburos de Colombia.

Desarrollado en el marco del módulo **Inventario de Pozos** del Sistema GOP.
