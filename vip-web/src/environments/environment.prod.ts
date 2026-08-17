/**
 * Configuración de producción. Complete `msal` con los valores del registro de
 * app en Entra ID (ver dotnet/docs/ENTRA-APP-REGISTRATION.md). Ajuste `apiBase`
 * si la API .NET no se sirve tras el mismo dominio que el SPA.
 */
export const environment = {
  production: true,
  apiBase: '',
  msal: {
    tenantId: '<TENANT_ID>',
    clientId: '<SPA_CLIENT_ID>',
    apiScope: 'api://anh-vip/access_as_user',
    redirectUri: 'https://vip.anh.gov.co',
    // Origen de la API para adjuntar el token; por defecto mismo origen + /api.
    apiBaseForToken: 'https://vip.anh.gov.co/api',
  },
};
