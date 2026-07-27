import { BehaviorSubject, Subscription } from 'rxjs';
import { STORAGE_KEY } from './constants';
import { IOhMyReadyResponse } from './packet-type';
import { IOhMyContext, IOhMyInjectedState } from './type';

/**
 * The namespace OhMyMock hangs off `window`, under the `STORAGE_KEY` name.
 *
 * Every part of the extension that runs in a page shares this object, yet it
 * used to be reached through `declare let window: any` in eleven files — so the
 * one thing they all agree on was the one thing nothing checked.
 *
 * The content script (isolated world) and the injected script (page context)
 * see *different* window objects and store different subsets here, so every
 * member is optional: presence depends on which side you are on and how far
 * start-up has got. `early-inject` in particular creates the namespace as `{}`
 * before anything else fills it in, so even `off` and `state` can be absent.
 */
export interface IOhMyWindow {
  /**
   * Teardown handles, run when the extension is re-injected or disabled.
   *
   * A mix of plain callbacks and RxJS subscriptions — `content/index.ts`
   * branches on `typeof h === 'function'` precisely because both land here.
   */
  off?: ((() => void) | Subscription)[];

  /** Responses waiting to be matched to a request (injected script). */
  cache?: IOhMyReadyResponse[];

  /** Whether mocking is switched on for this domain. */
  state?: IOhMyInjectedState;

  /** Emits once the injected bundle has loaded (content script side). */
  injectionDone$?: BehaviorSubject<boolean>;

  /** Version of the injected bundle, used to spot a stale content script. */
  version?: string;

  /**
   * The patched `fetch`.
   *
   * Deliberately not `typeof fetch`: `ohMyFetch` accepts the subset of the
   * signature the extension supports and resolves a plain object, so claiming
   * full `fetch` compatibility would be a lie the compiler then has to be
   * argued out of at every call site.
   */
  fetch?: (request: string | Request, config?: unknown) => Promise<unknown>;

  /** The original `fetch`, kept for passthrough and for restoring on unpatch. */
  __fetch?: typeof fetch;

  /** The patched XMLHttpRequest entry points. */
  xhr?: { send?: (this: XMLHttpRequest, body?: unknown) => void };

  /** Restores the original fetch/XHR implementations. */
  unpatch?: () => void;

  /** The API exposed to page scripts, see `src/injected/api.ts`. */
  api?: {
    upsert: (data: unknown, context?: IOhMyContext) => Promise<unknown>;
  };

  isEnabled?: boolean;
}

type WindowWithOhMy = Window & { [STORAGE_KEY]?: IOhMyWindow };

/**
 * Typed access to the OhMyMock namespace.
 *
 * Callers reach for this only where the namespace is known to exist — the
 * content script creates it before anything else runs, and the injected bundle
 * bails out early if it is missing. Use `hasOhMyWindow` where that is in doubt.
 */
export function ohMyWindow(target: Window = window): IOhMyWindow {
  return (target as WindowWithOhMy)[STORAGE_KEY] as IOhMyWindow;
}

export function setOhMyWindow(value: IOhMyWindow, target: Window = window): void {
  (target as WindowWithOhMy)[STORAGE_KEY] = value;
}

export function hasOhMyWindow(target: Window = window): boolean {
  return Boolean((target as WindowWithOhMy)[STORAGE_KEY]);
}
