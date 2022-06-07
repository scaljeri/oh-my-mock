import { TestBed } from '@angular/core/testing';

import { SandboxService } from './sandbox.service';

describe('SandboxService', () => {
  let service: SandboxService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SandboxService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
