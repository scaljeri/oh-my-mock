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
}

/** Ad-hoc members the shim parks on each XMLHttpRequest instance. */
interface IEarlyInjectXhr extends XMLHttpRequest {
  ohListeners?: EventListenerOrEventListenerObject[];
  ohHeaders?: Record<string, string>;
  ohMethod?: string;
  ohUrl?: string;
  __open: XMLHttpRequest['open'];
  __setRequestHeader: XMLHttpRequest['setRequestHeader'];
  __addEventListener: XMLHttpRequest['addEventListener'];
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

if (!ohMy()) {
  setOhMy({});

  const dsend = descriptorOf('send');
  const dopen = descriptorOf('open');
  const dseth = descriptorOf('setRequestHeader');

  Object.defineProperties(window.XMLHttpRequest.prototype, {
    send: {
      ...dsend,
      value: function (this: IEarlyInjectXhr, body?: Document | XMLHttpRequestBodyInit | null) {
        if (ohMy().xhr) {
          ohMy().xhr?.send.call(this, body);
        } else {
          // Wait for the injected code
          const sid = setInterval(() => {
            if (ohMy().xhr) {
              clearInterval(sid);
              ohMy().xhr?.send.call(this, body);
            }
          }, 50);
        }
      }
    },
    open: {
      ...dopen,
      value: function (this: IEarlyInjectXhr, ...args: Parameters<XMLHttpRequest['open']>) {
        this.ohListeners = [];
        this.ohHeaders = {};
        this.ohMethod = args[0].toUpperCase();
        this.ohUrl = String(args[1]);

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

  (window.XMLHttpRequest.prototype as IEarlyInjectXhr).__addEventListener =
    window.XMLHttpRequest.prototype.addEventListener;
  window.XMLHttpRequest.prototype.addEventListener = function (this: IEarlyInjectXhr, eventName: string, callback: EventListenerOrEventListenerObject) {
    if (eventName === 'load') {
      this.ohListeners ??= []; // just to be sure
      this.ohListeners.push(callback);
    }

    return this.__addEventListener(eventName, callback);
  }

  const origFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {

    return new Promise(function (r) {
      if (ohMy().fetch) {
        r(ohMy().fetch!(input, init));
      } else {
        const fid = setInterval(function () {
          if (ohMy().fetch) {
            clearInterval(fid);
            r(ohMy().fetch!(input, init));
          }
        }, 50);
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
