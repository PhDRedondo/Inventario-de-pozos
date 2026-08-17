#!/usr/bin/env bash
#
# Registra en Entra ID (Azure AD) las dos aplicaciones del VIP:
#   1. API   (Anh.Vip.Api)  — expone app roles operadora/anh/admin y un scope.
#   2. SPA   (vip-web)       — cliente Angular que obtiene el token para la API.
#
# Requisitos: Azure CLI (az) con sesión iniciada en el tenant de la OTI y
# permisos para crear App registrations (Application Administrator o superior).
#
# NO ejecuta nada destructivo: si las apps ya existen (por displayName) las
# reutiliza. Al final imprime los valores para appsettings y el SPA.
#
# Uso:
#   az login --tenant <TENANT_ID>
#   TENANT_ID=<guid> SPA_REDIRECT="https://vip.anh.gov.co" ./register-vip-entra.sh
#
set -euo pipefail

# --- Parámetros (con valores por defecto sensatos) --------------------------
TENANT_ID="${TENANT_ID:-$(az account show --query tenantId -o tsv)}"
API_NAME="${API_NAME:-ANH VIP API}"
SPA_NAME="${SPA_NAME:-ANH VIP Web}"
API_IDENTIFIER="${API_IDENTIFIER:-api://anh-vip}"
SPA_REDIRECT="${SPA_REDIRECT:-http://localhost:4200}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLES_FILE="$SCRIPT_DIR/app-roles.json"
GRAPH="https://graph.microsoft.com/v1.0"

echo "Tenant:        $TENANT_ID"
echo "API:           $API_NAME  ($API_IDENTIFIER)"
echo "SPA:           $SPA_NAME  (redirect $SPA_REDIRECT)"
echo

# --- 1. Registro de la API --------------------------------------------------
echo "==> Creando/actualizando el registro de la API…"
API_APP_ID="$(az ad app list --filter "displayName eq '$API_NAME'" --query "[0].appId" -o tsv)"
if [[ -z "$API_APP_ID" ]]; then
  API_APP_ID="$(az ad app create \
    --display-name "$API_NAME" \
    --sign-in-audience AzureADMyOrg \
    --app-roles @"$ROLES_FILE" \
    --query appId -o tsv)"
  echo "    creada API appId=$API_APP_ID"
else
  az ad app update --id "$API_APP_ID" --app-roles @"$ROLES_FILE"
  echo "    actualizada API appId=$API_APP_ID"
fi

# Object id del registro (para llamadas a Graph) y identifierUri (propiedad
# de nivel superior; PATCH aparte no afecta al objeto complejo "api").
API_OBJ_ID="$(az ad app show --id "$API_APP_ID" --query id -o tsv)"
az rest --method PATCH --uri "$GRAPH/applications/$API_OBJ_ID" --headers "Content-Type=application/json" \
  --body "{ \"identifierUris\": [\"$API_IDENTIFIER\"] }"

# Id estable del scope access_as_user (reutiliza el existente si ya está creado).
SCOPE_ID="$(az ad app show --id "$API_APP_ID" --query "api.oauth2PermissionScopes[?value=='access_as_user'].id | [0]" -o tsv)"
[[ -z "$SCOPE_ID" ]] && SCOPE_ID="$(uuidgen)"

# Service principal de la API (necesario para asignar app roles a usuarios/grupos).
az ad sp show --id "$API_APP_ID" >/dev/null 2>&1 || az ad sp create --id "$API_APP_ID" >/dev/null
echo "    API lista (appId=$API_APP_ID)."
echo

# --- 2. Registro del SPA (Angular) ------------------------------------------
echo "==> Creando/actualizando el registro del SPA…"
SPA_APP_ID="$(az ad app list --filter "displayName eq '$SPA_NAME'" --query "[0].appId" -o tsv)"
if [[ -z "$SPA_APP_ID" ]]; then
  SPA_APP_ID="$(az ad app create --display-name "$SPA_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
  echo "    creada SPA appId=$SPA_APP_ID"
else
  echo "    reutilizada SPA appId=$SPA_APP_ID"
fi
SPA_OBJ_ID="$(az ad app show --id "$SPA_APP_ID" --query id -o tsv)"

# --- 3. Configurar el objeto "api" de la API en UNA sola escritura ----------
# (Graph reemplaza los tipos complejos en PATCH: scope + token v2 +
#  preautorización del SPA deben ir juntos para no pisarse entre sí.)
echo "==> Configurando scope, token v2 y preautorización del SPA en la API…"
az rest --method PATCH --uri "$GRAPH/applications/$API_OBJ_ID" --headers "Content-Type=application/json" --body "$(cat <<JSON
{
  "api": {
    "requestedAccessTokenVersion": 2,
    "oauth2PermissionScopes": [{
      "id": "$SCOPE_ID",
      "value": "access_as_user",
      "type": "User",
      "isEnabled": true,
      "adminConsentDisplayName": "Acceder al VIP como el usuario",
      "adminConsentDescription": "Permite a la app web llamar a la API del VIP en nombre del usuario.",
      "userConsentDisplayName": "Acceder al VIP en tu nombre",
      "userConsentDescription": "Permite a la app web llamar a la API del VIP en tu nombre."
    }],
    "preAuthorizedApplications": [{
      "appId": "$SPA_APP_ID",
      "delegatedPermissionIds": ["$SCOPE_ID"]
    }]
  }
}
JSON
)"

echo "==> Redirect SPA + permiso delegado hacia la API…"
az rest --method PATCH --uri "$GRAPH/applications/$SPA_OBJ_ID" --headers "Content-Type=application/json" --body "$(cat <<JSON
{
  "spa": { "redirectUris": ["$SPA_REDIRECT"] },
  "requiredResourceAccess": [{
    "resourceAppId": "$API_APP_ID",
    "resourceAccess": [{ "id": "$SCOPE_ID", "type": "Scope" }]
  }]
}
JSON
)"
az ad sp show --id "$SPA_APP_ID" >/dev/null 2>&1 || az ad sp create --id "$SPA_APP_ID" >/dev/null
echo

# --- 3. Salida para la configuración ----------------------------------------
cat <<OUT
============================================================================
 Registro completado. Configure la API (appsettings.Production.json):

   "Oidc": {
     "Authority": "https://login.microsoftonline.com/$TENANT_ID/v2.0",
     "Audience":  "$API_IDENTIFIER"
   }

 Configure el SPA (vip-web/src/environments/environment.prod.ts):

   msalConfig = {
     tenantId: "$TENANT_ID",
     clientId: "$SPA_APP_ID",
     apiScope: "$API_IDENTIFIER/access_as_user"
   }

 Pasos manuales pendientes (portal de Entra):
   1. Asignar usuarios/grupos a los app roles (operadora | anh | admin) en
      «Aplicaciones empresariales» -> ANH VIP API -> Usuarios y grupos.
   2. Emitir el claim personalizado «operadora» para los usuarios de operadora
      (extensión de directorio o claims-mapping policy). Ver ENTRA-APP-REGISTRATION.md.
   3. Exigir MFA por Acceso Condicional sobre estas aplicaciones.
============================================================================
OUT
