import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { msalConfigured, msalProviders } from './auth/msal.config';

// Producción (Entra ID configurado): MSAL adjunta el token y protege las rutas.
// Desarrollo: interceptor de token simple (la API .NET auto-autentica).
const authProviders = msalConfigured()
  ? [provideHttpClient(withInterceptorsFromDi()), ...msalProviders()]
  : [provideHttpClient(withInterceptors([authInterceptor]))];

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    ...authProviders,
  ],
};
