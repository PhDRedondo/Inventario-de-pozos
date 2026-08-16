import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        AuthService,
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.setToken(null);
  });

  afterEach(() => mock.verify());

  it('attaches the bearer token to API requests', () => {
    auth.setToken('TKN123');
    http.get('/api/notebooks/1').subscribe();
    const req = mock.expectOne('/api/notebooks/1');
    expect(req.request.headers.get('Authorization')).toBe('Bearer TKN123');
    req.flush({});
  });

  it('does not attach a header when there is no token', () => {
    http.get('/api/notebooks/1').subscribe();
    const req = mock.expectOne('/api/notebooks/1');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('does not attach the token to non-API requests', () => {
    auth.setToken('TKN123');
    http.get('/assets/config.json').subscribe();
    const req = mock.expectOne('/assets/config.json');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
