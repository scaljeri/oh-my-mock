import { TestBed } from '@angular/core/testing';

import { MockXmlHttpRequestService } from './mock-xml-http-request.service';

describe('MockXmlHttpRequestService', () => {
  let service: MockXmlHttpRequestService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MockXmlHttpRequestService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
