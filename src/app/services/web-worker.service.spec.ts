import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { IMock } from '@shared/type';
import { OhWWPacketTypes } from '../webworkers/types';
import { OH_MY_SEARCH_WORKER_FACTORY } from './search-worker.token';
import { OhMyStateService } from './state.service';
import { WebWorkerService } from './web-worker.service';

describe('WebWorkerService', () => {
  let service: WebWorkerService;
  let response$: Subject<IMock>;
  let postMessage: jest.Mock;

  beforeEach(() => {
    response$ = new Subject<IMock>();
    postMessage = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: OhMyStateService, useValue: { response$ } },
        {
          provide: OH_MY_SEARCH_WORKER_FACTORY,
          useValue: () => ({ postMessage }) as unknown as Worker
        }
      ]
    });

    service = TestBed.inject(WebWorkerService);
  });

  /**
   * `init` runs on every domain switch, and it used to subscribe to
   * `response$` each time — after visiting N domains, every response update
   * was posted to the worker N times.
   */
  it('posts a response update once, however often init has run', async () => {
    // An empty domain makes `loadAllMocks` answer without touching storage,
    // which this spec does not have.
    await service.init('');
    await service.init('');
    postMessage.mockClear();

    response$.next({ id: 'm1' } as IMock);

    const posted = postMessage.mock.calls.filter(
      ([packet]) =>
        packet.type === OhWWPacketTypes.MOCKS && packet.body?.['m1']
    );

    expect(posted.length).toBe(1);
  });
});
