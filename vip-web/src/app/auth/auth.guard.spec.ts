import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  it('permite el acceso en desarrollo (sin MSAL configurado)', () => {
    // El entorno de pruebas no trae config `msal`, así que el guard no exige sesión.
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(result).toBeTrue();
  });
});
