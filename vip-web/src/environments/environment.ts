/**
 * Configuración de entorno. `apiBase` vacío usa el mismo origen (con proxy en
 * desarrollo, ver proxy.conf.json). En producción se sirve tras el mismo dominio
 * institucional o se ajusta a la URL de la API .NET.
 */
export const environment = {
  production: false,
  apiBase: '',
};
