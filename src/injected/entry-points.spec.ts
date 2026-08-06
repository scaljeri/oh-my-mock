/**
 * The window-level patches, which are on every page the extension mocks — so
 * anything they get wrong is a bug on somebody's real site.
 *
 * These pin the two ways the shim they replace used to be wrong (a patched
 * `addEventListener` that dropped the options argument, and an `open` that did
 * not reset the previous request's verdict on a reused instance), plus the two
 * properties the new arrangement rests on: the originals are saved before the
 * page can reach them, and a call goes to the page's own implementation
 * whenever this bundle has not published a mocking entry point.
 */
import { STORAGE_KEY } from '../shared/constants';
import { IOhMyWindow, ohMyWindow } from '../shared/oh-my-window';

type Namespace = Record<string, unknown>;
const ns = (): IOhMyWindow => ohMyWindow();

const PATCHED = ['send', 'open', 'setRequestHeader'] as const;

describe('the page-world entry points', () => {
  let installEntryPoints: () => void;
  let nativeFetch: typeof fetch;
  let nativeSend: XMLHttpRequest['send'];

  // `XMLHttpRequest.prototype` is one object shared by every test in this file,
  // and installing over an already-patched prototype would back the *patch* up
  // as the original — `__open` calling the patched `open`, forever. So each
  // test starts from the descriptors the environment came with.
  const pristine = new Map(
    PATCHED.map(name => [
      name,
      Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, name) as PropertyDescriptor
    ])
  );

  beforeEach(() => {
    jest.resetModules();
    delete (window as unknown as Namespace)[STORAGE_KEY];

    for (const name of PATCHED) {
      Object.defineProperty(XMLHttpRequest.prototype, name, pristine.get(name)!);
      Reflect.deleteProperty(XMLHttpRequest.prototype, `__${name}`);
    }

    // What a fresh page has: the browser's own implementations.
    nativeFetch = jest.fn(() => Promise.resolve({} as Response)) as unknown as typeof fetch;
    window.fetch = nativeFetch;
    nativeSend = jest.fn();
    XMLHttpRequest.prototype.send = nativeSend;

    installEntryPoints = (require('./entry-points') as {
      installEntryPoints: () => void;
    }).installEntryPoints;
  });

  afterAll(() => {
    for (const name of PATCHED) {
      Object.defineProperty(XMLHttpRequest.prototype, name, pristine.get(name)!);
      Reflect.deleteProperty(XMLHttpRequest.prototype, `__${name}`);
    }
  });

  it('creates the namespace it is the first thing on the page to need', () => {
    installEntryPoints();

    expect((window as unknown as Namespace)[STORAGE_KEY]).toBeDefined();
  });

  /**
   * The reason this runs at `document_start` in the page's own world: a page
   * that grabs `window.fetch` in its first inline script must get ours, and the
   * function it replaced has to be recoverable.
   */
  it('takes over fetch and keeps the page own one', () => {
    installEntryPoints();

    expect(window.fetch).not.toBe(nativeFetch);
    expect(ns().__fetch).toBe(nativeFetch);
  });

  it('records the request line for mock matching', () => {
    installEntryPoints();

    const xhr = new XMLHttpRequest() as XMLHttpRequest & {
      ohMethod?: string; ohUrl?: string; ohHeaders?: Record<string, string>;
    };

    xhr.open('post', '/api/things');
    xhr.setRequestHeader('x-one', '1');

    expect(xhr.ohMethod).toBe('POST');
    expect(xhr.ohUrl).toBe('/api/things');
    expect(xhr.ohHeaders).toEqual({ 'x-one': '1' });
  });

  /**
   * `addEventListener` used to be wrapped, to collect `load` listeners for
   * replay — and the wrapper forwarded only `(name, callback)`, so `once`,
   * `capture`, `passive` and `{ signal }` silently stopped working for XHR
   * everywhere. Mocked completions go through `dispatchEvent` now, nothing
   * needs collecting, and the browser's own `addEventListener` must stay.
   */
  it('leaves addEventListener untouched, so listener options keep working', () => {
    installEntryPoints();

    const xhr = new XMLHttpRequest();
    const listener = jest.fn();

    xhr.addEventListener('load', listener, { once: true });
    xhr.dispatchEvent(new Event('load'));
    xhr.dispatchEvent(new Event('load'));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  /**
   * `open` starts a new request cycle on the instance. It used to reset only
   * its own bookkeeping (`ohMethod`, `ohUrl`, ...) while the *verdict* of the
   * previous cycle stayed: `ohResult` made the patched accessors answer the
   * second request from the first request's mock, and the own `readyState`
   * data property a mocked completion defines kept shadowing the prototype
   * accessor, so the instance reported DONE forever.
   */
  it('open clears the previous request verdict and the readyState shadow', () => {
    installEntryPoints();

    const xhr = new XMLHttpRequest() as XMLHttpRequest & {
      ohResult?: unknown; __ohIsPerisisted?: boolean; __ohMyHasError?: boolean;
    };

    // What a completed mocked request leaves behind on the instance.
    xhr.ohResult = { response: { status: 1 } };
    xhr.__ohIsPerisisted = true;
    xhr.__ohMyHasError = false;
    Object.defineProperty(xhr, 'readyState', { value: XMLHttpRequest.DONE, configurable: true });

    xhr.open('GET', '/second-request');

    expect(xhr.ohResult).toBeUndefined();
    expect(xhr.__ohIsPerisisted).toBeUndefined();
    expect(xhr.__ohMyHasError).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(xhr, 'readyState')).toBeUndefined();
    expect(xhr.readyState).toBe(XMLHttpRequest.OPENED);
  });

  /**
   * The entry points are in place from `document_start`, but the mocking
   * patches they forward to are published a few statements later and are taken
   * away again on a domain that turns out to be switched off. Anything the page
   * does in either window has to reach the browser, unchanged — this is the
   * whole of what happens on a page the extension does not mock.
   */
  describe('with nothing published to forward to', () => {
    it('hands fetch to the page own implementation', async () => {
      installEntryPoints();

      await window.fetch('/api/json', { method: 'POST' });

      expect(nativeFetch).toHaveBeenCalledWith('/api/json', { method: 'POST' });
    });

    it('hands send to the page own implementation', () => {
      installEntryPoints();

      const xhr = new XMLHttpRequest();

      xhr.open('POST', '/api/things');
      xhr.send('a body');

      expect(nativeSend).toHaveBeenCalledWith('a body');
    });
  });

  it('forwards to the mocking entry points once they are published', async () => {
    installEntryPoints();

    const mockFetch = jest.fn(() => Promise.resolve('mocked'));
    const mockSend = jest.fn();

    ns().fetch = mockFetch as unknown as IOhMyWindow['fetch'];
    ns().xhr = { send: mockSend };

    await window.fetch('/api/json');

    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/things');
    xhr.send();

    expect(mockFetch).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalled();
    expect(nativeFetch).not.toHaveBeenCalled();
    expect(nativeSend).not.toHaveBeenCalled();
  });

  /**
   * Installing twice would back up the *patched* functions as the originals,
   * and the page could never be given its own back.
   */
  it('does not install over itself', () => {
    installEntryPoints();

    const patched = window.fetch;

    installEntryPoints();

    expect(window.fetch).toBe(patched);
    expect(ns().__fetch).toBe(nativeFetch);
  });

  /**
   * ...but a page that was handed its own `fetch`/`XHR` back has to be able to
   * take them a second time: switching a domain on while its page is open is
   * what the popup's toggle does.
   */
  it('installs again after the page own implementations were handed back', () => {
    installEntryPoints();

    // What `restoreOriginals` leaves behind: the page's own implementations
    // back in place, the copies gone, and a flag saying so.
    window.fetch = nativeFetch;
    for (const name of PATCHED) {
      Object.defineProperty(XMLHttpRequest.prototype, name, pristine.get(name)!);
      Reflect.deleteProperty(XMLHttpRequest.prototype, `__${name}`);
    }
    XMLHttpRequest.prototype.send = nativeSend;
    ns().restored = true;

    installEntryPoints();

    expect(window.fetch).not.toBe(nativeFetch);
    expect(ns().restored).toBe(false);
  });
});
