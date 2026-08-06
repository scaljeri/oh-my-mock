import { hasOhMyWindow, ohMyWindow, setOhMyWindow } from '../shared/oh-my-window';
import { IOhMyXhr, toXhrBody, xhrDescriptor } from './oh-my-xhr';

/**
 * Takes over `window.fetch` and `XMLHttpRequest.prototype`, before the page has
 * run a line of its own.
 *
 * This bundle is registered as a `world: 'MAIN'` content script at
 * `document_start` — see `src/background/main-world.ts` — so "before the page"
 * is a property of *when this file is evaluated*, not something that has to be
 * arranged. It used to be: a separate shim (`src/early-inject`) was spliced
 * into the content script as a string and clicked into the page through a
 * `<div onclick>`, because a content script in the isolated world cannot patch
 * anything the page can see. It parked itself over `fetch`/`XHR` and *held*
 * every call, polling at 50ms, until the real bundle arrived over a
 * `<script src>` — with a ten-second backstop in case it never did. All of
 * that existed to bridge the gap between the two scripts. There is one script
 * now, and no gap.
 *
 * The indirection through `ohMy.fetch` / `ohMy.xhr` stays, though both ends are
 * in this bundle: those two are (re-)published by `patchFetch` /
 * `patchXmlHttpRequest`, and an inactive domain deletes them again — see
 * `restore-originals.ts`. Forwarding through the namespace is what lets the
 * page keep one stable `window.fetch` across all of that.
 */
export function installEntryPoints(): void {
  // The namespace is created here, first thing, because nothing else in the
  // page's world exists yet: the content script's copy lives in the isolated
  // world and is a different object entirely.
  if (!hasOhMyWindow()) {
    setOhMyWindow({});
  }

  const ohMy = ohMyWindow();

  // Installed once per page, and again after a restore: a domain that turns out
  // to be switched off gets its own `fetch`/`XHR` back, and switching it on
  // while the page is open has to be able to install over them a second time.
  // `__fetch` is the "already installed" marker — the namespace itself is not,
  // because it outlives the patches. Without the `restored` check a page that
  // came back would find the namespace, skip, and silently mock nothing.
  if (ohMy.__fetch && !ohMy.restored) {
    return;
  }

  ohMy.restored = false;

  const dsend = xhrDescriptor('send');
  const dopen = xhrDescriptor('open');
  const dseth = xhrDescriptor('setRequestHeader');

  Object.defineProperties(window.XMLHttpRequest.prototype, {
    send: {
      ...dsend,
      value: function (this: IOhMyXhr, body?: unknown) {
        // `ohMy.xhr` is absent only while this domain is switched off — its
        // patches were handed back — so the page's own `send` is the right
        // place for the call, and it goes there synchronously. `send` is
        // expected to have acted by the time it returns.
        if (ohMy.xhr?.send) {
          ohMy.xhr.send.call(this, body);
        } else {
          this.__send(toXhrBody(body));
        }
      }
    },
    open: {
      ...dopen,
      value: function (this: IOhMyXhr, ...args: Parameters<XMLHttpRequest['open']>) {
        this.ohHeaders = {};
        this.ohMethod = args[0].toUpperCase() as IOhMyXhr['ohMethod'];
        this.ohUrl = String(args[1]);

        // `open` starts a new request cycle on this instance, so everything the
        // previous cycle left behind has to go. `ohResult` is the old verdict:
        // kept, it answers the next request from the previous request's mock.
        // The `readyState` shadow is the own data property a mocked completion
        // defines over the prototype accessor; kept, the instance reports DONE
        // forever, however far the new request has actually got. Deleting a
        // property that was never set is a no-op, and deleting the shadow never
        // reaches the prototype accessor behind it.
        delete this.ohResult;
        delete this.__ohIsPerisisted;
        delete this.__ohMyHasError;
        Reflect.deleteProperty(this, 'readyState');

        this.__open(...args);
      }
    },
    setRequestHeader: {
      ...dseth,
      value: function (this: IOhMyXhr, key: string, value: string) {
        this.ohHeaders ??= {}; // `open` seeds this, but a stray call must not throw
        this.ohHeaders[key] = value;

        return this.__setRequestHeader(key, value);
      }
    },
    __send: dsend,
    __open: dopen,
    __setRequestHeader: dseth
  });

  // `addEventListener` is deliberately not patched. It used to be, to collect
  // `load` listeners for the bundle to replay by hand — and the patch dropped
  // the third argument, so `once`, `capture`, `passive` and `signal` silently
  // stopped working for XHR on every page the extension touched. A mocked
  // request completes with `dispatchEvent` now, which runs whatever is
  // registered on the instance with full listener semantics, so there is
  // nothing to collect and the page's `addEventListener` stays the browser's
  // own.

  const origFetch = window.fetch;

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const mock = ohMy.fetch;

    // Same shape as `send` above: no patch published means this domain is
    // switched off, and the call goes to the function the page started with.
    if (!mock) {
      return origFetch.call(window, input, init);
    }

    return mock(input as string | Request, init) as Promise<Response>;
  };

  ohMy.__fetch = origFetch;
}
