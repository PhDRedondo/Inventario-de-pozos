import { APP_INITIALIZER, EnvironmentProviders, Provider } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import {
  BrowserCacheLocation,
  IPublicClientApplication,
  InteractionType,
  LogLevel,
  PublicClientApplication,
} from '@azure/msal-browser';
import {
  MSAL_GUARD_CONFIG,
  MSAL_INSTANCE,
  MSAL_INTERCEPTOR_CONFIG,
  MsalBroadcastService,
  MsalGuard,
  MsalGuardConfiguration,
  MsalInterceptor,
  MsalInterceptorConfiguration,
  MsalService,
} from '@azure/msal-angular';
import { environment } from '../../environments/environment';

/** Configuración Entra ID del SPA (se define en environment.prod.ts). */
export interface MsalSettings {
  tenantId: string;
  clientId: string;
  /** Scope de la API, p. ej. `api://anh-vip/access_as_user`. */
  apiScope: string;
  /** Redirect URI registrado; por defecto el origen actual. */
  redirectUri?: string;
  /** Origen de la API para adjuntar el token (por defecto, mismo origen + /api). */
  apiBaseForToken?: string;
}

/** Lee la configuración MSAL del entorno (null en desarrollo). */
export function msalSettings(): MsalSettings | null {
  return (environment as unknown as { msal?: MsalSettings | null }).msal ?? null;
}

/** ¿Está el SPA configurado para autenticación Entra ID? */
export function msalConfigured(): boolean {
  return !!msalSettings()?.clientId;
}

export function msalInstanceFactory(): IPublicClientApplication {
  const s = msalSettings()!;
  return new PublicClientApplication({
    auth: {
      clientId: s.clientId,
      authority: `https://login.microsoftonline.com/${s.tenantId}`,
      redirectUri: s.redirectUri ?? window.location.origin,
      postLogoutRedirectUri: s.redirectUri ?? window.location.origin,
    },
    cache: {
      // sessionStorage: el token no persiste entre pestañas/cierres (más seguro).
      cacheLocation: BrowserCacheLocation.SessionStorage,
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: { logLevel: LogLevel.Warning, piiLoggingEnabled: false },
    },
  });
}

export function msalGuardConfigFactory(): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: { scopes: [msalSettings()!.apiScope] },
  };
}

export function msalInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const s = msalSettings()!;
  const apiBase = s.apiBaseForToken ?? `${window.location.origin}/api`;
  const protectedResourceMap = new Map<string, Array<string> | null>([
    [`${apiBase}/*`, [s.apiScope]],
    [apiBase, [s.apiScope]],
  ]);
  return { interactionType: InteractionType.Redirect, protectedResourceMap };
}

/**
 * Providers de MSAL (Entra ID) para el SPA. Solo se incluyen cuando el entorno
 * trae configuración `msal` (producción); en desarrollo la API auto-autentica y
 * se usa el interceptor de token simple.
 */
export function msalProviders(): (Provider | EnvironmentProviders)[] {
  return [
    { provide: MSAL_INSTANCE, useFactory: msalInstanceFactory },
    { provide: MSAL_GUARD_CONFIG, useFactory: msalGuardConfigFactory },
    { provide: MSAL_INTERCEPTOR_CONFIG, useFactory: msalInterceptorConfigFactory },
    { provide: HTTP_INTERCEPTORS, useClass: MsalInterceptor, multi: true },
    MsalService,
    MsalGuard,
    MsalBroadcastService,
    // MSAL v4 exige initialize() antes de usar la instancia.
    {
      provide: APP_INITIALIZER,
      useFactory: (msal: MsalService) => () => msal.instance.initialize(),
      deps: [MsalService],
      multi: true,
    },
  ];
}
