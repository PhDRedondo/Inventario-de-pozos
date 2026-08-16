import { Injectable } from '@angular/core';

/**
 * Almacén del token de acceso. En producción envolverá la sesión OIDC/MSAL
 * (Microsoft Entra ID / AD FS) tras el login institucional con MFA; aquí expone
 * la interfaz mínima que consume el interceptor.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly KEY = 'vip_token';
  private token: string | null = this.readStored();

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
    try {
      if (token) localStorage.setItem(AuthService.KEY, token);
      else localStorage.removeItem(AuthService.KEY);
    } catch {
      /* almacenamiento no disponible: se mantiene solo en memoria */
    }
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }

  logout(): void {
    this.setToken(null);
  }

  private readStored(): string | null {
    try {
      return localStorage.getItem(AuthService.KEY);
    } catch {
      return null;
    }
  }
}
