import { TestBed } from '@angular/core/testing';

import { UpdatesReceiverService } from './updates-receiver.service';

describe('UpdatesReceiverService', () => {
  let service: UpdatesReceiverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UpdatesReceiverService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
