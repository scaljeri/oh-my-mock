import { ohMyWindow } from '../shared/oh-my-window';

/**
 * Puts the page's own `fetch` and `XMLHttpRequest` back.
 *
 * Called once the verdict is "this domain is not mocked". Passing every call
 * through a wrapper would work, but the wrapper is on *every* page the user
 * visits now — the price of being in place before the answer is known — and a
 * page nobody is mocking should not keep paying it. After this OhMyMock is not
 * merely inert, it is gone: `window.fetch` is the function the page started
 * with, and `XMLHttpRequest.prototype` carries none of our members.
 *
 * What is undone here was installed by two different files. `src/early-inject`
 * owns the window-level patches — it is the one that runs before any page script
 * — and saved each original next to its replacement (`__fetch`, `__send`,
 * `__open`, `__setRequestHeader`, `__addEventListener`). The bundle's own
 * `Response`/`XMLHttpRequest` accessor patches are undone by their own
 * `unpatch*` functions, which the caller runs alongside this.
 */
export function restoreOriginals(): void {
  const ohMy = ohMyWindow();
  const proto = window.XMLHttpRequest.prototype as unknown as Record<string, unknown>;

  if (ohMy.__fetch) {
    window.fetch = ohMy.__fetch;
  }

  // Each `__name` holds the descriptor the shim replaced, so restoring is a
  // matter of putting it back under its real name and dropping the copy.
  for (const name of ['send', 'open', 'setRequestHeader'] as const) {
    const saved = Object.getOwnPropertyDescriptor(proto, `__${name}`);

    if (saved) {
      Object.defineProperty(proto, name, saved);

      // Kept on the namespace before the prototype copy goes, the way
      // `__fetch` already is — and for the same reason.
      //
      // This runs in the *same synchronous frame* as `settleActiveState`, which
      // only queues the calls held for the verdict as microtasks. One of those
      // reaching `xhr.__send` afterwards finds nothing there: a TypeError
      // inside a promise with no catch, and a request that is neither sent nor
      // failed. `fetch` never had that problem because its original survives on
      // the namespace.
      //
      // Ordinarily the content script's `releaseEarlyShim()` drains those calls
      // before the verdict gets this far, which is why it does not show up in
      // the normal flow — I could not reproduce it through the on-load path.
      // It needs the shim's 50ms poll to hand a call to the bundle before the
      // verdict arrives, i.e. a slow start. Cheap to make impossible.
      if (name === 'send') {
        ohMy.__xhrSend = saved.value as XMLHttpRequest['send'];
      }

      Reflect.deleteProperty(proto, `__${name}`);
    }
  }

  // `addEventListener` was replaced by assignment rather than by descriptor.
  if (typeof proto.__addEventListener === 'function') {
    proto.addEventListener = proto.__addEventListener;
    Reflect.deleteProperty(proto, '__addEventListener');
  }

  // The two the bundle publishes for the shim to forward to. Left behind they
  // would make a re-installed shim think the bundle is still driving.
  delete ohMy.fetch;
  delete ohMy.xhr;

  // Tells the shim it may install itself again — see `src/early-inject`. Without
  // it, switching the domain on while the page is open would find the namespace
  // present, skip, and silently mock nothing.
  ohMy.restored = true;
}
