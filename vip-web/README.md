# vip-web — Frontend Angular (Fase 3)

Interfaz web en **Angular 18** para el Validador del Inventario de Pozos (VIP),
tercer paso del plan de migración al stack institucional ANH
([`../docs/guia-produccion-anh.html`](../docs/guia-produccion-anh.html) §4).
Reemplaza la UI del piloto (Next.js/React) y consume la **Web API .NET**
(`../dotnet`, `Anh.Vip.Api`).

> Estándar aplicado: **ANH-GTIC-MA-02 §10.2** — Angular para interfaces web.

## Alcance

**Cuadernos** (`/`): listado del inventario de cuadernos (`GET /api/notebooks`)
y creación; cada fila abre el workspace.

**Workspace del cuaderno** (`/cuadernos/:id`): carga el detalle
(`GET /api/notebooks/{id}`), descarga plantilla, carga el Excel (`POST .../upload`),
revisa versiones y hallazgos filtrables (`GET /api/validations`) y aplica a la
ANH (`POST .../submit`).

**Panel** (`/panel`): KPIs y desgloses del inventario aplicado (por operadora,
departamento, estado y objetivo) más la tabla de pozos, desde `GET /api/stats`
(alcance por rol).

**Analítica** (`/analitica`): radar comparativo (SVG) de una operadora o
departamento frente al promedio nacional (base 100) más barras de índice, desde
`GET /api/analytics`. Selector de **tema**: `perfil` (porcentajes operativos),
`produccion` (petróleo/gas/agua/días acumulados) e `inyeccion` (agua/gas/otros),
con el sufijo `%` solo en el tema perfil.

**Flujo** (`/flujo`): diagrama Sankey (SVG) Departamento → Estado → Operadora,
desde `GET /api/analytics/sankey`.

**Mapa** (`/mapa`): mapa territorial (Leaflet) con **coropleto municipal**
(GeoJSON DANE `colombia-municipios.geojson`, unido por `MPIO_CCNCT`) desde
`GET /api/wells/by-municipio`, el **contorno de los departamentos** como
contexto y **un punto por pozo** coloreado por validación desde
`GET /api/wells/map`. Un **conmutador de vista** colorea el coropleto por
**número de pozos** (escala teal 1/2/3+) o por **producción de petróleo**
(escala ámbar: sin producción / <10.000 / 10.000–20.000 / ≥20.000 BBL), cada
uno con su leyenda. Cada municipio tiene un **tooltip** (hover) con la
producción acumulada (petróleo BBL · gas KPC · agua BBL) y un **popup** (clic)
con el total, el desglose válido/advertencia/inválido y la producción detallada.

Estructura: `services/vip-api.service.ts` (cliente tipado), `models/` (contratos
de la API), `notebooks/` (listado), `cuaderno/` (workspace), `panel/`,
`analitica/` (radar), `flujo/` (Sankey), `mapa/` (Leaflet), `auth/`
(token + interceptor).

## Requisitos

- **Node.js 18.19+** (probado con 20.x) y npm.
- Para el flujo completo, la API .NET corriendo (ver `../dotnet`).

## Comandos

```bash
npm install

# Desarrollo (proxy /api -> http://localhost:5199, ver proxy.conf.json)
npm start                 # ng serve, http://localhost:4200

# Build de producción (AOT)
npm run build             # -> dist/vip-web

# Pruebas unitarias (Karma + ChromeHeadless)
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  npx ng test --watch=false --browsers=ChromeHeadless
```

La URL base de la API se configura en `src/environments/environment.ts`
(`apiBase`), vacía por defecto (mismo origen + proxy en desarrollo).

## Estado de verificación

- ✅ **`ng build --configuration production`**: compila (AOT), bundle ~80 kB gzip.
- ✅ **`ng test` (ChromeHeadless):** **17/17** — cliente de API con
  `HttpTestingController` (crear/listar/detalle de cuaderno, carga multipart,
  validaciones, submit, plantilla, stats, analítica, Sankey, mapa), interceptor
  de token (adjunta Bearer solo a `/api/`) y render del shell.
- ✅ **Render verificado** en el navegador (`ng serve`): shell VIP y formulario
  del cuaderno.

## Seguridad

El wiring de autenticación es **condicional por entorno** (`app.config.ts`):

- **Desarrollo** (`environment.msal = null`): la API .NET auto-autentica con el
  esquema Dev, así que `auth/auth.interceptor.ts` adjunta un token simple (si lo
  hay) a `/api/` y `auth/auth.guard.ts` permite el acceso sin login.
- **Producción / Entra ID** (`environment.prod.ts` con `msal`): se activa
  **MSAL** (`@azure/msal-angular`) — login por redirect contra Microsoft Entra
  ID (con MFA por Acceso Condicional), `MsalInterceptor` adjunta el token de
  acceso de la API y `MsalGuard` (vía `authGuard`) protege todas las rutas. El
  header muestra el usuario y un botón Ingresar/Salir.

Configuración MSAL en `auth/msal.config.ts` (instancia, guard e interceptor).
Build para Entra: `ng build --configuration entra` (reemplaza `environment.ts`
por `environment.prod.ts`). Registro del tenant y valores (tenantId, clientId,
`apiScope`): ver [dotnet/docs/ENTRA-APP-REGISTRATION.md](../dotnet/docs/ENTRA-APP-REGISTRATION.md).

## Siguiente

- Pantallas de panel/analítica y listado de cuadernos (requiere endpoints
  adicionales en la API).
