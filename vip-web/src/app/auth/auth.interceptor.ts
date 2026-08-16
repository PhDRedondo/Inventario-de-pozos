import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Adjunta el token de acceso (Authorization: Bearer …) a las peticiones a la API.
 * El token, al no ir en cookie, mitiga CSRF frente al backend (bearer).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (token && req.url.includes('/api/')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};
