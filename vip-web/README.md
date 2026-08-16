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
(GeoJSON DANE `colombia-municipios.geojson`, unido por `MPIO_CCNCT`) sombreado
por número de pozos desde `GET /api/wells/by-municipio`, el **contorno de los
departamentos** como contexto y **un punto por pozo** coloreado por validación
desde `GET /api/wells/map`. El popup de cada municipio muestra el total y el
desglose válido/advertencia/inválido.

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

- `auth/auth.service.ts` guarda el token de acceso; `auth/auth.interceptor.ts`
  lo adjunta como `Authorization: Bearer …` a las llamadas a `/api/`. Registrado
  en `app.config.ts` con `withInterceptors`.
- **Producción:** integrar `@azure/msal-angular` para el login OIDC contra
  Microsoft Entra ID / AD FS (con MFA) y alimentar `AuthService` con el token.

## Siguiente

- Login OIDC (MSAL) + guardas de ruta por rol.
- Pantallas de panel/analítica y listado de cuadernos (requiere endpoints
  adicionales en la API).
