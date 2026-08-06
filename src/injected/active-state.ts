import { ohMyWindow } from '../shared/oh-my-window';
import { IOhMyInjectedState } from '../shared/types/store';
import { error } from './utils';

/**
 * Whether this page is being mocked — and, crucially, whether that is known yet.
 *
 * There are three states, not two. The bundle is injected the moment the content
 * script starts, before it has read `chrome.storage`, so for the first few
 * milliseconds of every page the honest answer is *"not decided"*.
 *
 * That distinction is the whole point. `ohMyWindow().state` is undefined until
 * the verdict arrives, and every check used to read it as
 * `!state?.active` — treating "don't know" as "no" and letting the call straight
 * through. A page that calls its API from an inline script in `<head>` lands in
 * exactly that window, so its request was never mocked. Asking first and acting
 * on the answer is what loses it; intercepting first and deciding after is what
 * does not.
 */
let settle: ((state: IOhMyInjectedState) => void) | undefined;

const verdict = new Promise<IOhMyInjectedState>((resolve) => {
  settle = resolve;
});

/** Called with the first real state the content script sends. */
export function settleActiveState(state: IOhMyInjectedState): void {
  settle?.(state);
  settle = undefined;
}

/**
 * How long to wait for a verdict that may never come.
 *
 * Only the content script settles this, and it can stop being able to: the
 * extension may be reloaded under a live page, its storage read may throw, the
 * injection promise it awaits before speaking may never resolve. There was no
 * backstop on this wait at all — `ANSWER_TIMEOUT` guards the round trip in
 * `dispatch-api-request.ts`, which a held call only *reaches* once the verdict
 * is in — so any of those left every request the page made pending for ever,
 * and every request it made afterwards with it.
 *
 * Matched to `ANSWER_TIMEOUT` on purpose, and generous for the same reason: a
 * guard against never, not a latency budget. Firing early would let a request
 * through unmocked that was about to be mocked, which is the exact failure this
 * whole file exists to prevent.
 */
const VERDICT_TIMEOUT = 10_000;

/**
 * One timer for the page, not one per request.
 *
 * Created on the first call that actually has to wait: a page whose verdict
 * arrives before it makes a request never starts one.
 */
let backstop: Promise<void> | undefined;

function verdictBackstop(): Promise<void> {
  backstop ??= new Promise<void>((resolve) => {
    const id = setTimeout(() => {
      error(
        `OhMyMock heard nothing from the extension within ${VERDICT_TIMEOUT}ms; ` +
        `letting this page's requests through unmocked`
      );

      resolve();
    }, VERDICT_TIMEOUT);

    // A verdict that does arrive takes the timer with it, so nothing keeps the
    // page awake for ten seconds over a request that was answered at once.
    void verdict.then(() => clearTimeout(id));
  });

  return backstop;
}

/**
 * Resolves as soon as it is known whether this page is mocked.
 *
 * Returns immediately once the verdict is in — which it is for every request
 * after the first handful, so this costs a microtask and nothing else.
 *
 * The backstop only unblocks the wait; it deliberately does not write a state.
 * "Nobody answered" is not the same as "this domain is off", and a real verdict
 * arriving late must still switch mocking on for everything that follows.
 */
export async function isMockingActive(): Promise<boolean> {
  if (!ohMyWindow().state) {
    await Promise.race([verdict, verdictBackstop()]);
  }

  return !!ohMyWindow().state?.active;
}
