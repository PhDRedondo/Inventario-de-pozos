# Integración con la infraestructura OTI (SQL Server · Entra ID · SMTP)

Runbook de las tres integraciones institucionales de la Web API `Anh.Vip.Api`.
Todas se resuelven por **configuración** (`appsettings.json` / variables de
entorno) sin cambios de código. Este documento incluye tanto el procedimiento
para la OTI como la **verificación local** que ya se ejecutó en este repositorio.

> Estándares: ANH-GTIC-MA-02 (SQL Server 2019/2022; .NET/C#) y GU-18 (AD+MFA,
> roles, endurecimiento).

---

## 1. SQL Server (persistencia)

La API usa EF Core con el proveedor SQL Server y el esquema `[vip]`. En
desarrollo/demo se puede usar `UseInMemoryDatabase=true`; en la OTI se apunta a
la instancia institucional.

### Configuración

```jsonc
// appsettings.json (o variables de entorno)
"UseInMemoryDatabase": false,
"ConnectionStrings": {
  // Autenticación integrada (cuenta de servicio del pool de aplicaciones):
  "VipDb": "Server=SQLINST\\VIP;Database=VIP_Inventario;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=True"
}
```

### Aplicar el esquema

```bash
# La fábrica de diseño toma la cadena de la variable VIP_DB.
export VIP_DB="Server=...;Database=VIP_Inventario;..."
dotnet ef database update \
  --project src/Anh.Vip.Infrastructure \
  --startup-project src/Anh.Vip.Infrastructure
```

Crea 10 tablas en `[vip]` + `__EFMigrationsHistory` (migración `InitialCreate`).

### ✅ Verificación local ejecutada

- SQL Server **2022** en contenedor (`mcr.microsoft.com/mssql/server:2022-latest`).
- `dotnet ef database update` aplicado → base `VIP_Inventario` con las **10
  tablas en `[vip]`** + `__EFMigrationsHistory` (confirmado con `sqlcmd`).
- API arrancada con `UseInMemoryDatabase=false` → **round-trip real**:
  `POST /api/notebooks` persiste el cuaderno y `GET /api/notebooks` lo lee vía
  EF Core; la fila se verificó directamente en `vip.notebooks`.

---

## 2. Entra ID (autenticación) + MFA

En producción la API valida **JWT Bearer** contra el tenant Entra ID. Los roles
(`Operadora`, `Anh`, `Admin`) se leen del claim `roles` (app roles de Entra).

### Configuración

```jsonc
"Oidc": {
  "Authority": "https://login.microsoftonline.com/<TENANT_ID>/v2.0",
  "Audience":  "api://anh-vip"   // App ID URI o client id del registro de app
}
```

- Registrar la API en Entra (App registration), exponer un scope/`App ID URI`
  y definir los **app roles** `operadora`, `anh`, `admin`; asignarlos a los
  grupos/usuarios correspondientes. Automatizado en
  [`scripts/entra/register-vip-entra.sh`](../scripts/entra/register-vip-entra.sh);
  guía completa (roles, claim `operadora`, MFA) en
  [ENTRA-APP-REGISTRATION.md](ENTRA-APP-REGISTRATION.md).
- **MFA** se exige del lado de Entra mediante **Acceso Condicional** (no en el
  código de la app); la API solo valida el token resultante.
- **Fail-closed:** en producción, si falta `Oidc:Authority` o `Oidc:Audience`, la
  API **aborta el arranque** con un mensaje claro (evita quedar en 401 silencioso).
  En el perfil Dev y en el arnés de pruebas se usa un esquema sustituto.

### ✅ / ⛔ Estado de verificación

- ✅ Wiring de JWT Bearer (Authority/Audience/roles) y validación **fail-closed**
  cubierta por pruebas unitarias (`OidcConfig.Validate`).
- ⛔ Validación de un token real contra un tenant Entra: **pendiente** (no hay
  tenant en este entorno). Requiere el registro de app de la OTI.

---

## 3. SMTP (notificación de aplicación)

Al **aplicar (submit)** un cuaderno, la API notifica a la ANH por correo. El
envío es *best-effort*: si el SMTP falla, el submit no se revierte (se registra
el error). Sin `Smtp:Host` configurado se usa un emisor de **solo-registro**
(desarrollo/InMemory, sin servidor SMTP).

### Configuración

```jsonc
"Smtp": {
  "Host": "smtp.anh.gov.co",
  "Port": 587,
  "EnableSsl": true,
  "From": "vip@anh.gov.co",
  "AnhRecipient": "inventariopozos@anh.gov.co",
  "User": "",        // vacío => envío anónimo/integrado
  "Password": ""
}
```

### ✅ Verificación local ejecutada

- Catcher SMTP local (`maildev`, puerto 1025).
- API (contra SQL Server) → `POST /api/notebooks/1/submit` → `SmtpEmailSender`
  transmitió un **SMTP real** recibido por maildev:
  `vip@anh.gov.co -> inventariopozos@anh.gov.co`,
  asunto `VIP · Inventario aplicado — HOCOL S.A.`.
- Además, un test de integración captura el correo del flujo de submit
  (destinatario, asunto con la operadora y cuerpo con `N/N pozos válidos`).

---

## Reproducir la verificación local

```bash
# SQL Server 2022
docker run -d --name vip-sql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='Vip_Local_2026!' \
  -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest

export VIP_DB="Server=localhost,1433;Database=VIP_Inventario;User Id=sa;Password=Vip_Local_2026!;TrustServerCertificate=True;Encrypt=True"
dotnet ef database update --project src/Anh.Vip.Infrastructure --startup-project src/Anh.Vip.Infrastructure

# Catcher SMTP
docker run -d --name vip-mail -p 1025:1025 -p 1080:1080 maildev/maildev

# API contra SQL Server + SMTP local
ASPNETCORE_ENVIRONMENT=Development UseInMemoryDatabase=false \
  ConnectionStrings__VipDb="$VIP_DB" \
  Smtp__Host=localhost Smtp__Port=1025 Smtp__EnableSsl=false \
  dotnet run --project src/Anh.Vip.Api -c Release
```
