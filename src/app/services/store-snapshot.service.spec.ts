import { TestBed } from '@angular/core/testing';

import { StoreSnapshotService } from './store-snapshot.service';

describe('StoreSnapshotService', () => {
  let service: StoreSnapshotService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StoreSnapshotService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
