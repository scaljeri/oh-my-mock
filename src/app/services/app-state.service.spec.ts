import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { IPacketPayload } from '@shared/packet-type';

import { AppStateService } from './app-state.service';

describe('AppStateService', () => {
  let service: AppStateService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Both streams go through `shareReplay`, which — called without a buffer
   * size — replays *everything it has ever seen* to each late subscriber and
   * holds all of it for the life of the popup. A late subscriber wants where
   * things stand, not the history.
   */
  describe('late subscribers', () => {
    it('receive only the latest domain, not every switch ever made', fakeAsync(() => {
      // An early subscriber, so the replay operator is connected and buffering.
      service.domain$.subscribe();

      service.domain = 'a.example';
      tick();
      service.domain = 'b.example';
      tick();

      const late: (string | null)[] = [];

      service.domain$.subscribe((domain) => late.push(domain));

      expect(late).toEqual(['b.example']);
    }));

    it('receive only the latest error, not the whole log', () => {
      service.errors$.subscribe();

      service.addError({ description: 'first' } as IPacketPayload);
      service.addError({ description: 'second' } as IPacketPayload);

      const late: IPacketPayload[] = [];

      service.errors$.subscribe((error) => late.push(error));

      expect(late).toEqual([{ description: 'second' }]);
    });
  });
});
