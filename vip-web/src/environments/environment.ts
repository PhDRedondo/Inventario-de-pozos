/**
 * Configuración de entorno. `apiBase` vacío usa el mismo origen (con proxy en
 * desarrollo, ver proxy.conf.json). En producción se sirve tras el mismo dominio
 * institucional o se ajusta a la URL de la API .NET.
 */
export const environment = {
  production: false,
  apiBase: '',
  // Desarrollo: sin MSAL (la API .NET auto-autentica con el esquema Dev).
  msal: null as null | {
    tenantId: string;
    clientId: string;
    apiScope: string;
    redirectUri?: string;
    apiBaseForToken?: string;
  },
};
