import { TestBed } from '@angular/core/testing';

import { MigrationsService } from './migrations.service';

describe('MigrationsService', () => {
  let service: MigrationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MigrationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
