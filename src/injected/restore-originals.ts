import { ohMyWindow } from '../shared/oh-my-window';

/**
 * Puts the page's own `fetch` and `XMLHttpRequest` back.
 *
 * Called once the content script says "this domain is not mocked", which is a
 * rarer thing to hear than it used to be: the bundle is registered per active
 * domain now, so being on the page normally *is* the answer. What still reaches
 * here is a host whose other port is the one being mocked — a content-script
 * match pattern cannot carry a port — and a registration that outlived the
 * domain it was made for. Neither should keep paying for a wrapper it does not
 * use. After this OhMyMock is not merely inert, it is gone: `window.fetch` is
 * the function the page started with, and `XMLHttpRequest.prototype` carries
 * none of our members.
 *
 * What is undone here was installed in two steps, both in this bundle.
 * `installEntryPoints` (`entry-points.ts`) owns the window-level patches — it
 * runs before any page script — and saved each original next to its replacement
 * (`__fetch`, `__send`, `__open`, `__setRequestHeader`). The
 * `Response`/`XMLHttpRequest` accessor patches are undone by their own
 * `unpatch*` functions, which the caller runs alongside this.
 */
export function restoreOriginals(): void {
  const ohMy = ohMyWindow();
  const proto = window.XMLHttpRequest.prototype as unknown as Record<string, unknown>;

  if (ohMy.__fetch) {
    window.fetch = ohMy.__fetch;
  }

  // Each `__name` holds the descriptor `installEntryPoints` replaced, so
  // restoring is a matter of putting it back under its real name and dropping
  // the copy.
  for (const name of ['send', 'open', 'setRequestHeader'] as const) {
    const saved = Object.getOwnPropertyDescriptor(proto, `__${name}`);

    if (saved) {
      Object.defineProperty(proto, name, saved);

      // Kept on the namespace before the prototype copy goes, the way
      // `__fetch` already is — and for the same reason.
      //
      // A request dispatched just before this runs finishes in a promise
      // callback, and `sendNow` reaches for `xhr.__send` there. Finding nothing
      // is a TypeError inside a promise with no catch, and a request that is
      // neither sent nor failed. `fetch` never had that problem because its
      // original survives on the namespace.
      if (name === 'send') {
        ohMy.__xhrSend = saved.value as XMLHttpRequest['send'];
      }

      Reflect.deleteProperty(proto, `__${name}`);
    }
  }

  // `addEventListener` needs no restoring: it stopped being patched when mocked
  // requests started completing through `dispatchEvent` — the listeners are on
  // the instance already, so there is nothing to collect and nothing to put
  // back.

  // The two the entry points forward to. Left behind, a re-installed entry
  // point would think this bundle is still driving.
  delete ohMy.fetch;
  delete ohMy.xhr;

  // Says the entry points may be installed again — see `entry-points.ts`.
  // Without it, switching the domain on while the page is open would find the
  // namespace present, skip, and silently mock nothing.
  ohMy.restored = true;
}
