import { TestBed } from '@angular/core/testing';
import { AppStateService } from './app-state.service';

import { ContentService } from './content.service';

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: AppStateService, useValue: {} }],
      imports: [],
    });
    service = TestBed.inject(ContentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
