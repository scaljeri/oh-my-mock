import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NgApiMockApiService } from './ng-api-mock-api.service';

describe('NgApiMockApiService', () => {
  let service: NgApiMockApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule]});
    service = TestBed.inject(NgApiMockApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
