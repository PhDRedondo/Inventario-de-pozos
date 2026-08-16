import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VipApiService } from './vip-api.service';
import { UploadResult, ValidationResult } from '../models/notebook.models';

describe('VipApiService', () => {
  let service: VipApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VipApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VipApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('creates a notebook via POST /api/notebooks', () => {
    service.createNotebook({ operadora: 'HOCOL S.A.', title: 't' }).subscribe((n) => {
      expect(n.id).toBe(7);
    });
    const req = httpMock.expectOne('/api/notebooks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.operadora).toBe('HOCOL S.A.');
    req.flush({ id: 7, operadora: 'HOCOL S.A.', title: 't', status: 'active' });
  });

  it('uploads a version as multipart form-data', () => {
    const file = new File(['x'], 'inv.xlsx');
    const expected: UploadResult = {
      upload_id: 3,
      version_number: 1,
      summary: { total: 2, valid: 0, withWarnings: 0, invalid: 2, errorTotal: 5, warningTotal: 1 },
    };
    service.uploadVersion(10, file).subscribe((r) => expect(r).toEqual(expected));
    const req = httpMock.expectOne('/api/notebooks/10/upload');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBeTrue();
    req.flush(expected);
  });

  it('gets validations with the uploadId query param', () => {
    const rows: ValidationResult[] = [
      { well_id: 1, operadora: 'X', nombre_pozo_sgc: 'A', is_valid: false, error_count: 1, warning_count: 0, uwi_fiscalizado: null, issues: [] },
    ];
    service.getValidations(3).subscribe((r) => expect(r.length).toBe(1));
    const req = httpMock.expectOne((r) => r.url === '/api/validations' && r.params.get('uploadId') === '3');
    expect(req.request.method).toBe('GET');
    req.flush(rows);
  });

  it('submits a notebook', () => {
    service.submit(10).subscribe((r) => expect(r.version_number).toBe(1));
    const req = httpMock.expectOne('/api/notebooks/10/submit');
    expect(req.request.method).toBe('POST');
    req.flush({ upload_id: 3, version_number: 1, message: 'ok' });
  });

  it('builds the template URL with rows and operadora', () => {
    const url = service.templateUrl(5, 'HOCOL S.A.');
    expect(url).toContain('/api/notebooks/template?');
    expect(url).toContain('rows=5');
    expect(url).toContain('operadora=HOCOL');
  });
});
