/**
 * The early shim patches `XMLHttpRequest.prototype` for *every* page the user
 * visits, mocked or not, so anything it gets wrong is a bug on the whole web
 * as far as that user is concerned. These specs pin the two ways it used to be
 * wrong: a patched `addEventListener` that dropped the options argument, and an
 * `open` that did not reset the previous request's verdict on a reused
 * instance.
 *
 * The module is a standalone script (no exports) that expects the content
 * script to prepend `const KEY = '...'`; here the global is provided by hand
 * before the module loads.
 */
import { STORAGE_KEY } from '../shared/constants';

describe('early-inject shim', () => {
  beforeAll(() => {
    (globalThis as unknown as { KEY: string }).KEY = STORAGE_KEY;
    require('./index');
  });

  it('installs itself under the storage key', () => {
    expect((window as unknown as Record<string, unknown>)[STORAGE_KEY]).toBeDefined();
  });

  it('records the request line for mock matching', () => {
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
   * The shim used to wrap `addEventListener` to collect `load` listeners for
   * replay — and the wrapper forwarded only `(name, callback)`, so `once`,
   * `capture`, `passive` and `{ signal }` silently stopped working for XHR
   * everywhere. Mocked completions go through `dispatchEvent` now, nothing
   * needs collecting, and the browser's own `addEventListener` must stay.
   */
  it('leaves addEventListener untouched, so listener options keep working', () => {
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
});
