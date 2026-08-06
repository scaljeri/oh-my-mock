/**
 * The wait for the verdict, and its backstop.
 *
 * The injected bundle holds every call the page makes until it knows whether
 * this domain is mocked — that hold is what stops an on-load request slipping
 * past while the content script is still reading storage. Only the content
 * script ends it, and a content script can stop being able to: the extension
 * reloaded under a live page, a storage read that threw, an injection promise
 * that never resolves. There was no backstop on this wait at all — the one in
 * `dispatch-api-request.ts` guards the round trip, which a held call only
 * *reaches* once the verdict is in — so any of those left every request the
 * page made pending for ever.
 */
import { IOhMyWindow, ohMyWindow, setOhMyWindow } from '../shared/oh-my-window';
import { IOhMyInjectedState } from '../shared/types/store';

type ActiveState = {
  isMockingActive: () => Promise<boolean>;
  settleActiveState: (state: IOhMyInjectedState) => void;
};

describe('waiting for the verdict', () => {
  let activeState: ActiveState;

  beforeEach(() => {
    jest.useFakeTimers();
    // A fresh module: the verdict promise is module state and is settled once.
    jest.resetModules();
    // No `state`: nobody has decided anything yet, which is where every page
    // starts.
    setOhMyWindow({ off: [], cache: [] } as IOhMyWindow);
    activeState = require('./active-state') as ActiveState;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** The one that used to hang the page. */
  it('lets the request through when the verdict never arrives', async () => {
    let answer: boolean | undefined;

    void activeState.isMockingActive().then(value => answer = value);

    await jest.advanceTimersByTimeAsync(10_000);

    expect(answer).toBe(false);
  });

  /**
   * And it is a backstop, not a deadline: a verdict that is merely slow must
   * still be waited for, or the hold is worthless.
   */
  it('keeps holding while the verdict is only slow', async () => {
    let answer: boolean | undefined;

    void activeState.isMockingActive().then(value => answer = value);

    await jest.advanceTimersByTimeAsync(5_000);
    expect(answer).toBeUndefined();

    ohMyWindow().state = { active: true };
    activeState.settleActiveState({ active: true });
    // Flushes the microtasks the `race` and the `async` wrapper add.
    await jest.advanceTimersByTimeAsync(0);

    expect(answer).toBe(true);
  });

  /**
   * "Nobody answered" is not "this domain is off". The backstop only unblocks
   * the wait — it writes no state — so a verdict that arrives after it has
   * fired still switches mocking on for everything that follows.
   */
  it('still mocks once a late verdict arrives', async () => {
    void activeState.isMockingActive();

    await jest.advanceTimersByTimeAsync(10_000);

    ohMyWindow().state = { active: true };
    activeState.settleActiveState({ active: true });

    await expect(activeState.isMockingActive()).resolves.toBe(true);
  });
});
