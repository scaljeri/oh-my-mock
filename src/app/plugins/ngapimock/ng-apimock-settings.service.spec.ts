import { TestBed } from '@angular/core/testing';

import { NgApimockSettingsService } from './ng-apimock-settings.service';

describe('NgApimockSettingsService', () => {
  let service: NgApimockSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NgApimockSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
