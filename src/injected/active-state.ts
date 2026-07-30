import { ohMyWindow } from '../shared/oh-my-window';
import { IOhMyInjectedState } from '../shared/types/store';

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
 * Resolves as soon as it is known whether this page is mocked.
 *
 * Returns immediately once the verdict is in — which it is for every request
 * after the first handful, so this costs a microtask and nothing else.
 */
export async function isMockingActive(): Promise<boolean> {
  if (!ohMyWindow().state) {
    await verdict;
  }

  return !!ohMyWindow().state?.active;
}
