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
 * How long to hold a call before giving up on hearing anything at all.
 *
 * `release` is what normally ends the wait, and only the content script sends
 * it. A content script that never gets that far — its extension reloaded under
 * a live page, a storage read that threw — left this shim polling for a bundle
 * that was never coming, with every request the page had made pending for ever
 * and every later one joining them. That is the worst failure this extension
 * has: the site looks broken and nothing anywhere says why.
 *
 * Deliberately long, and matched to the injected bundle's own backstop
 * (`ANSWER_TIMEOUT` in `src/injected/message/dispatch-api-request.ts`). This
 * guards against *never*; firing it early would send a request unmocked that
 * was about to be mocked, which is the very bug the holding was added to fix.
 */
const HOLD_TIMEOUT = 10000;

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

  // One installation's worth, and it has to be cleared here. `release` sets it
  // when the content script says no bundle is coming, and it used to survive
  // into the *next* installation: switching a domain on with the page open puts
  // this shim back over the page's own `fetch`/`XHR` (see `reinstallEarlyShim`),
  // and a `passthrough` left over from the previous life made it hand every call
  // straight to them instead of holding it for the bundle that was on its way.
  // Everything the page fired between the switch and the bundle re-publishing
  // its entry points went to the server unmocked, silently.
  ohMy().passthrough = false;

  // Calls being held until the injected bundle arrives, or until word comes
  // that none is. Each entry stops its own polling and lets its call through.
  const waiting: (() => void)[] = [];

  ohMy().release = function () {
    ohMy().passthrough = true;

    while (waiting.length) {
      waiting.shift()!();
    }
  };

  /**
   * Holds one call until there is somewhere to send it, and sends it **once**.
   *
   * There are three ways out — the bundle arriving, `release` giving up on it,
   * and the backstop — and they used to be independent of one another. The poll
   * handed a call to the bundle without taking its entry out of `waiting`, so a
   * `release` afterwards sent the very same request a second time through the
   * original. On a domain that is switched off both of those happen as a matter
   * of course: the bundle is injected before the verdict is known, and the
   * verdict is then what releases the shim. One `GET` reached the server twice —
   * intermittently, depending on which of the two won the race.
   *
   * @param hasBundle whether the injected bundle has published its entry point
   * @param toBundle  hand the call to the bundle
   * @param toNetwork hand the call to the implementation the page started with
   */
  const hold = function (hasBundle: () => boolean, toBundle: () => void, toNetwork: () => void): void {
    let done = false;

    // Declared before the timers it cancels, which are therefore referenced
    // ahead of their declaration — safe, because nothing can call this until
    // both have been started.
    const once = function (act: () => void): void {
      if (done) {
        return;
      }

      done = true;
      clearInterval(sid);
      clearTimeout(tid);
      act();
    };

    const sid = setInterval(function () {
      if (hasBundle()) {
        once(toBundle);
      }
    }, 50);

    // Giving up is done for every held call at once, through `release` — the
    // same door the content script uses — so `passthrough` is set with it and
    // calls made after this one do not each wait out their own timeout.
    const tid = setTimeout(function () {
      ohMy().release?.();
    }, HOLD_TIMEOUT);

    waiting.push(function () {
      once(toNetwork);
    });
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
          // Wait for the injected code, or for word that none is coming.
          hold(
            () => !!ohMy().xhr,
            () => ohMy().xhr?.send.call(this, body),
            () => this.__send(body)
          );
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
        hold(
          function () { return !!ohMy().fetch; },
          function () { r(ohMy().fetch!(input, init)); },
          // `origFetch.call(...)` is *evaluated* here, so reaching this after
          // the call has already gone to the bundle does not merely resolve a
          // promise that is already settled — it puts a second request on the
          // wire whose answer nobody reads. `hold` makes that impossible.
          function () { r(origFetch.call(window, input, init)); }
        );
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
