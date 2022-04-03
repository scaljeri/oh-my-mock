import { TestBed } from '@angular/core/testing';

import { CloudSyncService } from './cloud-sync.service';

describe('CloudSyncService', () => {
  let service: CloudSyncService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CloudSyncService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
