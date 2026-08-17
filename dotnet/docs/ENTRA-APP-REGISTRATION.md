# Registro de aplicación en Entra ID (Azure AD)

Guía para que la OTI registre el VIP en el tenant Entra ID institucional. Cubre
las **dos** aplicaciones (API y SPA), los **app roles**, el claim personalizado
**`operadora`**, la versión de token y **MFA**. Al terminar, la API valida los
tokens sin cambios de código: solo se completan `Oidc:Authority`/`Oidc:Audience`.

Automatizado en [`scripts/entra/register-vip-entra.sh`](../scripts/entra/register-vip-entra.sh)
(+ [`scripts/entra/app-roles.json`](../scripts/entra/app-roles.json)). Esta guía
explica cada paso y el equivalente por portal.

---

## 0. Requisitos

- Rol **Application Administrator** (o superior) en el tenant.
- Azure CLI con sesión: `az login --tenant <TENANT_ID>`.

## 1. Ejecutar el script

```bash
cd dotnet/scripts/entra
TENANT_ID=<guid> SPA_REDIRECT="https://vip.anh.gov.co" ./register-vip-entra.sh
```

Crea/actualiza:

| Aplicación | Qué configura |
|---|---|
| **ANH VIP API** | App roles `operadora`/`anh`/`admin`, `identifierUri = api://anh-vip`, scope `access_as_user`, `requestedAccessTokenVersion = 2`, service principal. |
| **ANH VIP Web** (SPA) | Redirect SPA, permiso delegado hacia la API, service principal, preautorización del scope. |

Al final imprime los valores para `appsettings.Production.json` y el SPA.

## 2. Equivalente por portal (si no se usa el script)

**API** — *Registros de aplicaciones → Nuevo registro* «ANH VIP API», solo este
directorio organizativo:

1. *Exponer una API* → **Application ID URI** `api://anh-vip`; agregar el scope
   `access_as_user`.
2. *Roles de aplicación* → crear tres con **valores exactos** (en minúscula, tal
   como los valida la API):

   | Nombre para mostrar | Valor | Tipos de miembro |
   |---|---|---|
   | Operadora | `operadora` | Usuarios/Grupos |
   | ANH | `anh` | Usuarios/Grupos |
   | Administrador | `admin` | Usuarios/Grupos |

3. *Manifiesto* → `requestedAccessTokenVersion: 2` (para que el token v2 coincida
   con el `Authority` `.../v2.0`).

**SPA** — *Nuevo registro* «ANH VIP Web», plataforma **SPA** con la redirect URL
(p. ej. `https://vip.anh.gov.co`); en *Permisos de API* agregar el scope
`api://anh-vip/access_as_user` y conceder consentimiento del administrador.

## 3. Asignar usuarios a los roles

*Aplicaciones empresariales → ANH VIP API → Usuarios y grupos → Agregar*:
asignar cada usuario o grupo al rol `operadora`, `anh` o `admin`. El rol viaje en
el claim **`roles`** del token; la API lo lee como rol (`RoleClaimType = "roles"`).

## 4. Claim personalizado `operadora` (acotación por empresa)

La API acota a cada usuario **operadora** a los pozos de su empresa leyendo un
claim **`operadora`** (`ClaimsPrincipalExtensions.GetOperadora`). Entra no lo
emite por defecto; opciones para poblarlo:

- **Atributo de extensión de directorio** (recomendado): definir una extensión
  (p. ej. `extension_<appId>_operadora`) en cada cuenta de usuario de operadora
  con el nombre exacto de la operadora (igual que en el catálogo del VIP), y
  emitirla como **optional claim** con nombre `operadora` en el token de acceso.
- **Claims-mapping policy**: mapear un atributo del directorio al claim
  `operadora` en el service principal de la API.

> Sin este claim, un usuario de rol `operadora` se autentica pero no vería su
> inventario acotado. Los roles `anh`/`admin` no lo necesitan.

## 5. MFA (Acceso Condicional)

MFA se exige **en Entra**, no en el código. En *Seguridad → Acceso Condicional*
crear una política dirigida a las apps **ANH VIP API** y **ANH VIP Web** que
requiera **autenticación multifactor** (GU-18). La API solo valida el token
resultante; no gestiona el segundo factor.

## 6. Configurar la aplicación

`appsettings.Production.json` (ver
[`appsettings.Production.template.json`](../src/Anh.Vip.Api/appsettings.Production.template.json)):

```jsonc
"Oidc": {
  "Authority": "https://login.microsoftonline.com/<TENANT_ID>/v2.0",
  "Audience":  "api://anh-vip"
}
```

En arranque, la API valida esta configuración **fail-closed**: si falta, aborta
con un mensaje claro (no queda en 401 silencioso).

---

## Estado

- ✅ Artefactos de registro listos (script, roles, plantilla de config) y wiring
  de la API (JWT Bearer + fail-closed) verificado por pruebas.
- ⛔ Ejecución contra el tenant Entra real y validación de un token emitido:
  **pendiente** — requiere el tenant de la OTI (no disponible en el entorno de
  desarrollo). El script está diseñado para ejecutarse tal cual allí.
