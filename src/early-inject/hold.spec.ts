/**
 * What the early shim does with a call it cannot answer yet.
 *
 * The shim is in place on *every* page the user visits, before the page has run
 * a line of its own and long before anyone knows whether the domain is mocked.
 * Holding a call is the whole point of it — and holding is exactly where the
 * ways of going wrong are: sending a request twice, sending it never, or
 * handing it to the network when it was about to be mocked. Each spec below is
 * one of those, as it actually happened.
 *
 * The module is a standalone script (no exports) that expects the content script
 * to prepend `const KEY = '...'`; here the global is provided by hand, and the
 * page's own `fetch`/`send` are jest mocks so that "reached the network" is
 * something a test can see.
 */
import { STORAGE_KEY } from '../shared/constants';

interface INamespace {
  fetch?: (input: unknown, init?: unknown) => Promise<unknown>;
  xhr?: { send: (this: XMLHttpRequest, body?: unknown) => void };
  __fetch?: (input: unknown, init?: unknown) => Promise<unknown>;
  passthrough?: boolean;
  restored?: boolean;
  release?: () => void;
}

const ns = (): INamespace =>
  (window as unknown as Record<string, INamespace>)[STORAGE_KEY];

const proto = () => XMLHttpRequest.prototype as unknown as Record<string, unknown>;

/** The XHR prototype as jsdom made it, before any shim touched it. */
const natives = {
  send: Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'send')!,
  open: Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'open')!,
  setRequestHeader: Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'setRequestHeader')!
};

/** The page's own implementations, as the shim finds them at install time. */
let realFetch: jest.Mock;
let realSend: jest.Mock;

function installShim(): void {
  jest.resetModules();
  require('./index');
}

/**
 * Exactly what `src/injected/restore-originals.ts` does: put each saved
 * descriptor back under its real name and drop the copy.
 */
function restoreOriginals(): void {
  ns().__fetch && (window.fetch = ns().__fetch as unknown as typeof fetch);

  for (const name of ['send', 'open', 'setRequestHeader'] as const) {
    const saved = Object.getOwnPropertyDescriptor(proto(), `__${name}`);

    if (saved) {
      Object.defineProperty(proto(), name, saved);
      Reflect.deleteProperty(proto(), `__${name}`);
    }
  }

  delete ns().fetch;
  delete ns().xhr;
  ns().restored = true;
}

describe('the early shim holding a call', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    (globalThis as unknown as { KEY: string }).KEY = STORAGE_KEY;
    delete (window as unknown as Record<string, unknown>)[STORAGE_KEY];

    for (const name of ['send', 'open', 'setRequestHeader'] as const) {
      Object.defineProperty(proto(), name, natives[name]);
    }
    for (const name of ['__send', '__open', '__setRequestHeader']) {
      Reflect.deleteProperty(proto(), name);
    }

    // Stand-ins for the network, installed *before* the shim so that they are
    // what it saves as the originals.
    realSend = jest.fn();
    Object.defineProperty(proto(), 'send', {
      value: realSend, writable: true, configurable: true
    });
    realFetch = jest.fn(() => Promise.resolve('from the network'));
    window.fetch = realFetch as unknown as typeof fetch;

    installShim();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * The duplicate send.
   *
   * A held call had two independent ways out: the poll that watches for the
   * bundle, and the `waiting` entry that `release` drains. The poll handed the
   * call over without removing its entry, so a `release` afterwards sent the
   * same request a second time through the original. Both happen as a matter of
   * course on a domain that is switched off — the bundle is injected before the
   * verdict is known, and the verdict is what releases the shim — which is how
   * one `GET` reached the server twice, depending on which won the race.
   */
  it('does not send a held fetch again when it is released after the bundle arrived', async () => {
    const held = window.fetch('/api/json');

    const bundleFetch = jest.fn(() => Promise.resolve('from the bundle'));
    ns().fetch = bundleFetch;
    jest.advanceTimersByTime(50);

    // ...and only then does the content script say "this domain is off".
    ns().release?.();

    await expect(held).resolves.toBe('from the bundle');
    expect(bundleFetch).toHaveBeenCalledTimes(1);
    expect(realFetch).not.toHaveBeenCalled();
  });

  /** The same race, over XHR. */
  it('does not send a held XHR again when it is released after the bundle arrived', () => {
    const xhr = new XMLHttpRequest();

    xhr.open('GET', '/api/json');
    xhr.send();

    const bundleSend = jest.fn();
    ns().xhr = { send: bundleSend };
    jest.advanceTimersByTime(50);

    ns().release?.();

    expect(bundleSend).toHaveBeenCalledTimes(1);
    expect(realSend).not.toHaveBeenCalled();
  });

  /**
   * The other half: a call that is never released.
   *
   * Only the content script sends `release`, and it can stop being able to —
   * its extension reloaded under a live page, a storage read that threw. The
   * shim then polled for a bundle that was never coming and the page's requests
   * never settled at all.
   */
  it('lets a held call through when nothing is ever heard from the extension', async () => {
    const held = window.fetch('/api/json');

    jest.advanceTimersByTime(10_000);

    expect(realFetch).toHaveBeenCalledTimes(1);
    await expect(held).resolves.toBe('from the network');
  });

  /** And having given up once, it does not make the next call wait again. */
  it('stops holding for good once it has given up', async () => {
    window.fetch('/api/json');
    jest.advanceTimersByTime(10_000);

    await expect(window.fetch('/api/later')).resolves.toBe('from the network');
    expect(realFetch).toHaveBeenCalledTimes(2);
  });

  /**
   * Switching a domain on with its page open.
   *
   * The "not this domain" verdict releases the shim and hands the page its own
   * `fetch`/`XHR` back, and the popup's toggle then puts the shim back over
   * them. `passthrough` belongs to one installation, but nothing cleared it, so
   * the re-installed shim handed every call straight to the network instead of
   * holding it for the bundle that was on its way — and everything the page
   * fired in that window went unmocked, silently.
   */
  it('holds again after being re-installed, rather than passing straight through', async () => {
    ns().release?.();
    restoreOriginals();

    installShim();

    const held = window.fetch('/api/json');

    jest.advanceTimersByTime(200);
    expect(realFetch).not.toHaveBeenCalled();

    const bundleFetch = jest.fn(() => Promise.resolve('from the bundle'));
    ns().fetch = bundleFetch;
    jest.advanceTimersByTime(50);

    await expect(held).resolves.toBe('from the bundle');
    expect(realFetch).not.toHaveBeenCalled();
  });
});
