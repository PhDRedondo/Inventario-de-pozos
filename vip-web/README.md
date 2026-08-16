# vip-web — Frontend Angular (Fase 3)

Interfaz web en **Angular 18** para el Validador del Inventario de Pozos (VIP),
tercer paso del plan de migración al stack institucional ANH
([`../docs/guia-produccion-anh.html`](../docs/guia-produccion-anh.html) §4).
Reemplaza la UI del piloto (Next.js/React) y consume la **Web API .NET**
(`../dotnet`, `Anh.Vip.Api`).

> Estándar aplicado: **ANH-GTIC-MA-02 §10.2** — Angular para interfaces web.

## Alcance de este incremento

Flujo del cuaderno (perfil operadora), consumiendo la API real:

- **Crear cuaderno** (`POST /api/notebooks`).
- **Descargar plantilla** con el nº de pozos (`GET /api/notebooks/template`).
- **Cargar el Excel** (`POST /api/notebooks/{id}/upload`), con resumen y versión.
- **Hallazgos de validación** por pozo, filtrables (`GET /api/validations`).
- **Aplicar a la ANH** cuando no hay pozos inválidos (`POST .../submit`).

Estructura: `services/vip-api.service.ts` (cliente tipado), `models/` (contratos
de la API), `cuaderno/` (componente del flujo).

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
- ✅ **`ng test` (ChromeHeadless):** **7/7** — cliente de API con
  `HttpTestingController` (crear cuaderno, carga multipart, validaciones con
  query, submit, URL de plantilla) y render del shell.
- ✅ **Render verificado** en el navegador (`ng serve`): shell VIP y formulario
  del cuaderno.

## Siguiente

- Autenticación (AD/OIDC + MFA) e interceptor de token — fase 4 de seguridad.
- Pantallas de panel/analítica y listado de cuadernos (requiere endpoints
  adicionales en la API).
