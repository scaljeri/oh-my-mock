import {
  ChangeDetectorRef,
  EnvironmentInjector,
  runInInjectionContext
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HotToastService } from '@ngxpert/hot-toast';

import {
  IOhMyRemoteStatus,
  RemoteService
} from '../../services/remote.service';
import { RemoteMockingComponent } from './remote-mocking.component';

/**
 * Constructed directly rather than rendered: these specs are about the
 * settle-watcher's lifetime, which lives in `ngOnInit`/`ngOnDestroy`, not in
 * the template.
 *
 * Jest's own fake timers rather than `fakeAsync`: the watcher is native
 * `async`/`await`, whose continuations the zone cannot see —
 * `advanceTimersByTimeAsync` interleaves timers with the microtask queue.
 */
describe('RemoteMockingComponent', () => {
  let component: RemoteMockingComponent;
  let status: jest.Mock;
  let detectChanges: jest.Mock;

  // A server that never connects, so the watcher keeps watching.
  const unreachable: IOhMyRemoteStatus = {
    target: 'server',
    connected: false,
    host: 'localhost',
    port: 3000,
    url: 'ws://localhost:3000'
  };

  beforeEach(() => {
    status = jest.fn().mockResolvedValue(unreachable);
    detectChanges = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: RemoteService, useValue: { status, update: jest.fn() } },
        { provide: HotToastService, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges } }
      ]
    });

    component = runInInjectionContext(
      TestBed.inject(EnvironmentInjector),
      () => new RemoteMockingComponent()
    );

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * The watcher polls between awaits, not in a subscription, so leaving the
   * page did not end it: it kept asking the background and marking a destroyed
   * view dirty for up to its full deadline.
   */
  it('stops watching the connection when the page is left', async () => {
    component.ngOnInit();
    await jest.advanceTimersByTimeAsync(0); // the first answer
    await jest.advanceTimersByTimeAsync(1000); // two polls

    const asked = status.mock.calls.length;

    expect(asked).toBeGreaterThan(1);

    component.ngOnDestroy();
    await jest.advanceTimersByTimeAsync(11_000); // the rest of the deadline

    expect(status.mock.calls.length).toBe(asked);
  });

  it('does not mark the view dirty for an answer that lands after destroy', async () => {
    let answerLate!: (settled: IOhMyRemoteStatus) => void;

    status
      .mockResolvedValueOnce(unreachable) // ngOnInit's own refresh
      .mockImplementationOnce(
        () => new Promise((resolve) => (answerLate = resolve))
      );

    component.ngOnInit();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(500); // the poll asks; no answer yet

    detectChanges.mockClear();
    component.ngOnDestroy();
    answerLate(unreachable);
    await jest.advanceTimersByTimeAsync(0);

    expect(detectChanges).not.toHaveBeenCalled();
  });
});
