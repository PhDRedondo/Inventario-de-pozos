# Inventario de Pozos — ANH (Sistema GOP)

Sistema web de la **Agencia Nacional de Hidrocarburos (ANH)** para la recepción, validación, consolidación y consulta del inventario de pozos reportado por operadoras. Implementa el flujo institucional del **Sistema de Gestión de Operaciones y Producción (GOP)**, con asignación de **UWI fiscalizado** según el instructivo ANH (abril 2026).

**Repositorio:** [github.com/PhDRedondo/Inventario-de-pozos](https://github.com/PhDRedondo/Inventario-de-pozos)

---

## Tabla de contenidos

- [Visión general](#visión-general)
- [Roles y permisos](#roles-y-permisos)
- [Flujo por rol](#flujo-por-rol)
- [Cuadernos de inventario](#cuadernos-de-inventario)
- [Panel y analítica](#panel-y-analítica)
- [Validación y UWI fiscalizado](#validación-y-uwi-fiscalizado)
- [Acceso demo](#acceso-demo)
- [Requisitos](#requisitos)
- [Instalación local](#instalación-local)
- [Despliegue en Vercel](#despliegue-en-vercel)
- [Variables de entorno](#variables-de-entorno)
- [Estructura del proyecto](#estructura-del-proyecto)
- [API principal](#api-principal)
- [Scripts útiles](#scripts-útiles)
- [Tecnologías](#tecnologías)
- [Limitaciones y próximos pasos](#limitaciones-y-próximos-pasos)

---

## Visión general

El sistema cubre el ciclo completo del inventario de pozos:

1. La **operadora** crea un **cuaderno**, carga versiones del Excel oficial y corrige hasta obtener cero errores.
2. Al **aplicar el envío a la ANH**, el lote queda visible en el panel institucional (simulación de correo a `correspondenciaanh@anh.gov.co`).
3. **Funcionarios ANH** consultan el inventario **ya validado** en el panel y profundizan en **analítica comparativa** (radar, mapas térmicos, nubes de producción).
4. El **administrador** gestiona usuarios y puede operar en nombre de cualquier operadora.

Los **40 atributos** del formato Excel están centralizados en `src/lib/attributes.ts` (29 columnas del mapa oficial + campos especiales + UWI fiscalizado).

---

## Roles y permisos

| Rol | Menú | Alcance de datos |
|-----|------|------------------|
| **Operadora** | Panel · Cuaderno | Solo pozos de su operadora (enviados/aplicados; borradores no visibles en panel hasta aplicar) |
| **ANH** | Panel · Analítica | Inventario consolidado validado (`valid` + `warning`) de operadoras que aplicaron envío |
| **Admin** | Panel · Cuaderno · Analítica · Usuarios | Acceso completo; puede cargar cuadernos en nombre de operadoras y administrar usuarios |

---

## Flujo por rol

### Operadora

```
Crear cuaderno → Cargar Excel → Validar (versiones) → Corregir errores → Aplicar a ANH
```

- Ruta: `/calidad` (inventario de cuadernos) y `/calidad/[id]` (trabajo dentro del cuaderno).
- Cada carga genera una **versión numerada** con trazabilidad (timeline de eventos).
- Solo la versión activa sin errores puede aplicarse.

### ANH

```
Panel (inventario validado) → Analítica (comparar vs promedio nacional)
```

- El panel **no muestra** filtros ni gráficos de re-validación (el inventario ya pasó el corte).
- Analítica: comparar operadora, departamento, municipio o pozo frente al promedio nacional.

### Admin

- Mismo cuaderno que operadora, con selector de operadora remitente.
- CRUD de usuarios en `/admin/usuarios`.
- Edición/eliminación de pozos con trazabilidad en `audit_log`.

---

## Cuadernos de inventario

Modelo de datos:

- **`notebooks`**: cuaderno de trabajo por operadora (`active` → `submitted` → `archived`).
- **`uploads`**: versiones/cargues dentro del cuaderno (`draft` → `submitted`).
- **`notebook_events`**: trazabilidad (creación, cargue, aplicación, archivo).

Solo puede haber **un cuaderno activo** por operadora; al crear uno nuevo, el anterior pasa a **archivado** y permanece consultable en el inventario histórico.

---

## Panel y analítica

### Panel (`/panel`)

- Mapa territorial de Colombia con filtros cruzados (pozo, operadora, departamento, estado).
- KPIs, gráficos (estado, departamento, operadoras), diagrama Sankey y tabla de pozos.
- Exportación de informe PDF del panel.

### Analítica (`/analitica`) — solo ANH y admin

Temas de indicadores:

| Tema | Métricas |
|------|----------|
| **Producción** | Días productivos, petróleo, agua, gas |
| **Inyección** | Días, agua, gas, otros fluidos |
| **Perfil operativo** | % activos, horizontales, productores, inyectores, coordenadas, UWI |
| **Portafolio** | Pozos por operadora, cobertura territorial, contratos |

Visualizaciones: **radar comparativo** (base = 100 nacional), barras de delta, nube de producción, mapas térmicos por departamento/operadora.

---

## Validación y UWI fiscalizado

- Validación de catálogos, campos obligatorios, coordenadas y reglas condicionales.
- Generación automática de **UWI fiscalizado** (metodología PPDM / instructivo ANH).

**Estructura UWI:**

```
[Depto 2][Municipio 3][Sigla 4][Número 4][Clúster][Ángulo][Trayectoria][Objetivo]-[Terminación]
```

Referencia: *INSTRUCTIVO UWI 16 DE ABRIL DE 2026*.

Informes exportables en Excel desde el cuaderno o la vista de calidad.

---

## Acceso demo

Contraseña compartida en entorno demo: **`Anh2026!`**

| Perfil | Usuario / correo | Notas |
|--------|------------------|-------|
| **Admin** | `johan.redondo@anh.gov.co` | Gestión completa |
| **ANH** | usuario: `funcionario` | Panel + analítica |
| **Operadora** | usuario: `demo` | GeoPark/Amerisur demo |

Inicio de sesión: `/login`

---

## Requisitos

- **Node.js** 20+
- **npm** 9+
- macOS / Linux / Windows (desarrollo local)
- Para producción serverless: cuenta [Vercel](https://vercel.com) vinculada al repo

---

## Instalación local

```bash
git clone https://github.com/PhDRedondo/Inventario-de-pozos.git
cd Inventario-de-pozos
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Datos iniciales

Al primer arranque, si la base está vacía, se cargan automáticamente **~70 registros de semilla** desde `data/seed.json` (extraídos del formato oficial ANH), con catálogos DANE y listas desplegables.

La base SQLite se crea en `data/inventario.db` (ignorada por git).

### Build de producción local

```bash
npm run build
npm start
```

---

## Despliegue en Vercel

El proyecto incluye configuración para Vercel (`vercel.json`) y rutas de datos compatibles con serverless (`src/lib/paths.ts` usa `/tmp` cuando `VERCEL=1`).

### Opción 1 — Dashboard (recomendada)

1. Ir a [vercel.com/new](https://vercel.com/new) e importar **PhDRedondo/Inventario-de-pozos**.
2. Framework: **Next.js** (detección automática).
3. Agregar variable de entorno `SESSION_SECRET` (cadena aleatoria de 32+ caracteres).
4. Deploy.

### Opción 2 — CLI

```bash
npm i -g vercel
vercel login
./scripts/vercel-deploy.sh
```

O doble clic en `Desplegar-Vercel-ANH.command` (macOS).

> **Nota:** En Vercel la base SQLite es **efímera** (se reinicia por instancia serverless). Adecuado para **demo institucional**; para producción persistente se recomienda PostgreSQL, Turso o similar.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `SESSION_SECRET` | Sí (prod) | Secreto para firmar cookies de sesión |
| `ANH_ADMIN_PASSWORD` | No | Contraseña inicial del admin semilla (default demo) |
| `VERCEL` | Auto | Detectada por Vercel; activa rutas `/tmp` para SQLite |

Ejemplo `.env.local` (desarrollo):

```env
SESSION_SECRET=dev-inventario-anh-secret-change-in-prod
```

---

## Estructura del proyecto

```
src/
├── app/                    # App Router (páginas y API routes)
│   ├── panel/              # Panel principal
│   ├── calidad/            # Inventario de cuadernos
│   ├── calidad/[id]/       # Workspace del cuaderno
│   ├── analitica/          # Analítica global (ANH)
│   ├── admin/usuarios/     # Administración de usuarios
│   └── api/                # REST endpoints
├── components/             # UI (mapa, sankey, cuaderno, etc.)
├── context/                # Auth y preferencias (tema, i18n)
├── i18n/                   # Español / English
└── lib/
    ├── attributes.ts       # Catálogo de 40 atributos
    ├── analytics.ts        # Temas y métricas de analítica
    ├── notebook-db.ts      # Cuadernos, versiones, eventos
    ├── db.ts               # SQLite, pozos, uploads, stats
    ├── validation.ts       # Reglas de validación
    └── uwi.ts              # Generación UWI fiscalizado
data/
├── seed.json               # Datos semilla (~70 pozos)
└── inventario.db           # Base local (generada, no versionada)
public/geo/                 # GeoJSON departamentos y municipios
scripts/
├── github-setup.sh         # Push inicial a GitHub (PhDRedondo)
├── vercel-deploy.sh        # Deploy a Vercel
└── test-uwi.ts             # Pruebas UWI
```

---

## API principal

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/auth/login` | POST | Inicio de sesión |
| `/api/stats` | GET | Estadísticas del panel (con scope por rol) |
| `/api/wells` | GET | Listado de pozos filtrados |
| `/api/wells/map` | GET | Puntos para mapa |
| `/api/notebooks` | GET/POST | Inventario / crear cuaderno |
| `/api/notebooks/[id]` | GET | Detalle, versiones, eventos |
| `/api/notebooks/[id]/upload` | POST | Cargar Excel (multipart) |
| `/api/notebooks/[id]/submit` | POST | Aplicar inventario a ANH |
| `/api/analytics` | GET | Indicadores y radar comparativo |
| `/api/analytics/entities` | GET | Búsqueda de entidades |
| `/api/validations` | GET | Informe de hallazgos por versión |
| `/api/validations/export` | GET | Export Excel de calidad |
| `/api/admin/users` | GET/POST | Usuarios (admin) |

Todas las rutas sensibles validan sesión y rol vía `src/lib/auth-scope.ts`.

---

## Scripts útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run start        # Servidor producción local
npm run lint         # ESLint
npm run test:uwi     # Pruebas generación UWI
```

---

## Tecnologías

| Capa | Stack |
|------|-------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Mapas | Leaflet, react-leaflet, GeoJSON Colombia |
| Gráficos | Recharts (panel, sankey, radar, analítica) |
| Backend | API Routes Next.js |
| Base de datos | SQLite (`better-sqlite3`) |
| Excel | xlsx (lectura), ExcelJS (exportación) |
| PDF | jsPDF + html2canvas |
| i18n | Español / English (`src/i18n`) |
| Tour guiado | driver.js |

---

## Limitaciones y próximos pasos

- **Persistencia en Vercel:** SQLite en `/tmp` no es durable; migrar a base gestionada para producción.
- **Correo real:** Los envíos se simulan en `data/outbox/` (local) o `/tmp` (Vercel); integrar SMTP institucional.
- **Autenticación:** Demo con usuarios locales; integrar SSO/LDAP ANH en producción.
- **ControlDoc:** Exportación Excel lista para carga manual; automatizar integración si la ANH lo requiere.

---

## Licencia y uso

Proyecto de **uso institucional** — Agencia Nacional de Hidrocarburos de Colombia.

Desarrollado en el marco del módulo **Inventario de Pozos** del Sistema GOP.
