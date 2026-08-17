import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { MsalGuard } from '@azure/msal-angular';
import { msalConfigured } from './msal.config';

/**
 * Protege las rutas: en producción (Entra ID configurado) delega en
 * <c>MsalGuard</c> — que exige sesión iniciada y dispara el login por redirect.
 * En desarrollo (sin MSAL) permite el acceso, ya que la API auto-autentica.
 */
export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  if (!msalConfigured()) return true;
  return inject(MsalGuard).canActivate(route, state);
};
