declare let KEY: string;

// NO TEMPLATE LITERALS IN THIS FILE.
//
// The compiled output is spliced into `content.js` *inside* a template literal
// (see `src/content/inject-code.ts`, where the `onclick` attribute is built,
// and `scripts/token-replace.js`, which substitutes the code). A backtick here
// closes that literal early and a `${...}` gets interpolated by the wrong
// scope — either way the content script fails to parse and nothing is
// injected at all. Use string concatenation instead.

/**
 * The slice of the OhMyMock namespace this shim needs.
 *
 * Declared locally rather than imported from `src/shared/oh-my-window.ts` on
 * purpose: this file is compiled to a standalone bundle and then inlined into
 * the content script as a raw string, with `const KEY = '...'` prepended at
 * runtime. It cannot reach for `STORAGE_KEY` the way the rest of the extension
 * does, so its view of the namespace has to stand on its own.
 */
interface IEarlyInjectNamespace {
  xhr?: { send: (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) => void };
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  __fetch?: typeof fetch;
  /**
   * The patches were removed again because this domain turned out not to be
   * mocked. The namespace outlives them, so it cannot be the "already
   * installed" test on its own.
   */
  restored?: boolean;
  /**
   * Stop holding: hand every call to the original implementation.
   *
   * Set by the content script (`releaseEarlyShim`) once it knows no injected
   * bundle is coming — the domain is switched off, or injection failed. This
   * shim is installed before any of that is known, so without a way to give up
   * it would poll for a bundle that never arrives and the page's own requests
   * would never settle.
   */
  passthrough?: boolean;
  /**
   * Stop holding, now.
   *
   * `passthrough` alone would do, but every held call is waiting on a 50ms
   * poll, so the page would pay up to another tick for an answer that is already
   * decided. Draining them costs nothing and this runs on every page the user
   * visits, mocked or not.
   */
  release?: () => void;
}

/**
 * Ad-hoc members the shim parks on each XMLHttpRequest instance.
 *
 * `ohResult` and the two `__oh*` flags are written by the injected bundle, not
 * by this shim — they are declared here because `open` marks the start of a new
 * request on this instance and must clear the previous request's verdict, or a
 * reused XHR answers its second request from its first request's mock.
 */
interface IEarlyInjectXhr extends XMLHttpRequest {
  ohHeaders?: Record<string, string>;
  ohMethod?: string;
  ohUrl?: string;
  ohResult?: unknown;
  __ohIsPerisisted?: boolean;
  __ohMyHasError?: boolean;
  __send: XMLHttpRequest['send'];
  __open: XMLHttpRequest['open'];
  __setRequestHeader: XMLHttpRequest['setRequestHeader'];
}

const ohMy = (): IEarlyInjectNamespace =>
  (window as unknown as Record<string, IEarlyInjectNamespace>)[KEY];

const setOhMy = (value: IEarlyInjectNamespace): void => {
  (window as unknown as Record<string, IEarlyInjectNamespace>)[KEY] = value;
};

// The descriptors always exist — these are standard XMLHttpRequest members —
// but `getOwnPropertyDescriptor` cannot know that, and passing `undefined` to
// `defineProperties` would quietly wreck the prototype.
const descriptorOf = (name: keyof XMLHttpRequest): PropertyDescriptor => {
  const descriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, name);

  if (!descriptor) {
    throw new Error('OhMyMock: XMLHttpRequest.prototype.' + String(name) + ' is missing');
  }

  return descriptor;
};

// Installed when the namespace is absent, and again after a restore: an
// inactive domain puts the page's own `fetch`/`XHR` back, and switching it on
// while the page is open has to be able to re-install over them.
if (!ohMy() || ohMy().restored) {
  // Created when absent, and only then. On a re-install the namespace already
  // exists and the injected bundle is holding a reference to that very object —
  // replacing it would leave the bundle writing into an orphan, so its `state`
  // would never be the one the page can see. Mutate.
  if (!ohMy()) {
    setOhMy({});
  }

  ohMy().restored = false;

  // Calls being held until the injected bundle arrives, or until word comes
  // that none is. Each entry stops its own polling and lets its call through.
  const waiting: (() => void)[] = [];

  ohMy().release = function () {
    ohMy().passthrough = true;

    while (waiting.length) {
      waiting.shift()!();
    }
  };

  const dsend = descriptorOf('send');
  const dopen = descriptorOf('open');
  const dseth = descriptorOf('setRequestHeader');

  Object.defineProperties(window.XMLHttpRequest.prototype, {
    send: {
      ...dsend,
      value: function (this: IEarlyInjectXhr, body?: Document | XMLHttpRequestBodyInit | null) {
        if (ohMy().xhr) {
          ohMy().xhr?.send.call(this, body);
        } else if (ohMy().passthrough) {
          this.__send(body);
        } else {
          // Wait for the injected code, or for word that none is coming. The
          // poll catches the bundle arriving; `release` drains this directly.
          const sid = setInterval(() => {
            if (ohMy().xhr) {
              clearInterval(sid);
              ohMy().xhr?.send.call(this, body);
            }
          }, 50);

          waiting.push(() => {
            clearInterval(sid);
            this.__send(body);
          });
        }
      }
    },
    open: {
      ...dopen,
      value: function (this: IEarlyInjectXhr, ...args: Parameters<XMLHttpRequest['open']>) {
        this.ohHeaders = {};
        this.ohMethod = args[0].toUpperCase();
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
      value: function (this: IEarlyInjectXhr, key: string, value: string) {
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
  // `load` listeners for the injected bundle to replay by hand — and the patch
  // dropped the third argument, so `once`, `capture`, `passive` and `signal`
  // silently stopped working for XHR on every page the user visits, mocked or
  // not. The bundle now completes a mocked request with `dispatchEvent`, which
  // runs whatever is registered on the instance with full listener semantics,
  // so there is nothing to collect and the page's `addEventListener` stays the
  // browser's own.

  const origFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {

    return new Promise(function (r) {
      if (ohMy().fetch) {
        r(ohMy().fetch!(input, init));
      } else if (ohMy().passthrough) {
        r(origFetch.call(window, input, init));
      } else {
        const fid = setInterval(function () {
          if (ohMy().fetch) {
            clearInterval(fid);
            r(ohMy().fetch!(input, init));
          }
        }, 50);

        waiting.push(function () {
          clearInterval(fid);
          r(origFetch.call(window, input, init));
        });
      }
    })
  }
  ohMy().__fetch = origFetch;
}

// Addressed to this document's own origin rather than '*', so the readiness
// ping is not readable by other frames. An opaque origin reports "null", which
// postMessage rejects as a target, so those fall back to '*' — the receiver
// still verifies event.source.
window.postMessage({
  source: 'pre-injected',
  payload: {
    type: 'ready',
    data: true
  }
}, !window.location.origin || window.location.origin === 'null' ? '*' : window.location.origin);
