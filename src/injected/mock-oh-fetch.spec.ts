/**
 * @jest-environment node
 *
 * Node, not jsdom, and that is the point: jsdom has no `fetch`, `Response` or
 * `Request` at all, while Node's are the real WHATWG classes — and this suite
 * is about fidelity to exactly those (body streams, `bodyUsed`, `clone()`,
 * internal status slots). The injected code reads everything off `window`, so
 * a minimal one is built by hand before anything is loaded.
 *
 * `dispatchApiRequest` is mocked: these specs cover what `ohMyFetch` does with
 * a verdict, not how the verdict travels.
 */
import type { IOhMyReadyResponse } from '../shared/packet-type';
import type { IOhMyResponse } from './fetch/oh-my-response';
import type { IOhMyMockResponse } from '../shared/type';

jest.mock('./message/dispatch-api-request', () => ({
  dispatchApiRequest: jest.fn()
}));

type OhMyFetch = (request: string | Request, init?: unknown) => Promise<IOhMyResponse>;

describe('ohMyFetch', () => {
  let dispatchApiRequestMock: jest.Mock;
  let fetchFn: OhMyFetch;
  let cache: IOhMyReadyResponse[];
  let originalFetchSpy: jest.Mock;
  let okStatus: number;
  let noContentStatus: number;

  beforeAll(() => {
    const g = globalThis as unknown as Record<string, unknown>;

    // The injected bundle runs in a page and reaches everything through
    // `window`; in this environment the global object plays that part.
    g.window = g;
    g.origin = 'http://localhost';
    g.location = { origin: 'http://localhost', host: 'localhost' };
    // `persistResponse` reports real responses to the content script this way.
    g.postMessage = jest.fn();

    // Loaded only now: the fetch patches snapshot `Response.prototype`
    // descriptors at module scope, so `window` has to exist first.
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { ohMyMockStatus } = require('../shared/constants');
    const { setOhMyWindow, ohMyWindow } = require('../shared/oh-my-window');
    const { patchFetch } = require('./mock-oh-fetch');
    const { dispatchApiRequest } = require('./message/dispatch-api-request');
    /* eslint-enable @typescript-eslint/no-var-requires */

    okStatus = ohMyMockStatus.OK;
    noContentStatus = ohMyMockStatus.NO_CONTENT;
    dispatchApiRequestMock = dispatchApiRequest as jest.Mock;

    setOhMyWindow({ state: { active: true }, cache: [], off: [] });
    patchFetch();

    fetchFn = ohMyWindow().fetch as OhMyFetch;
    cache = ohMyWindow().cache as IOhMyReadyResponse[];
    originalFetchSpy = jest.fn();
    ohMyWindow().__fetch = originalFetchSpy as unknown as typeof fetch;
  });

  beforeEach(() => {
    cache.length = 0;
    dispatchApiRequestMock.mockReset();
    originalFetchSpy.mockReset();
    // A passthrough answer that `persistResponse` can digest without jsdom
    // machinery: json is read with `clone().json()`, nothing needs FileReader.
    originalFetchSpy.mockImplementation(async () =>
      new Response('{"real":true}', { status: 200, headers: { 'content-type': 'application/json' } }));
  });

  /** The extension's verdict, wired the way the real dispatcher wires it. */
  function respondWith(response: Partial<IOhMyMockResponse>): void {
    dispatchApiRequestMock.mockImplementation(async (request) => {
      const ready = { request, response } as IOhMyReadyResponse;

      cache.unshift(ready);

      return ready;
    });
  }

  function okJson(body = '{"a":1}'): Partial<IOhMyMockResponse> {
    return {
      status: okStatus,
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      response: body,
      delay: 0
    };
  }

  describe('a mocked response behaves like a real one', () => {
    it('carries a real body: stream, json(), bodyUsed and url', async () => {
      respondWith(okJson());

      const res = await fetchFn('http://localhost/api/x');

      expect(res.url).toBe('http://localhost/api/x');
      expect(res.body).not.toBeNull();
      expect(res.bodyUsed).toBe(false);

      await expect(res.json()).resolves.toEqual({ a: 1 });

      expect(res.bodyUsed).toBe(true);
    });

    it('rejects a second body read, like the native readers', async () => {
      respondWith(okJson());

      const res = await fetchFn('http://localhost/api/x');
      await res.json();

      await expect(res.json()).rejects.toThrow(TypeError);
    });

    it('marks the body used through text() as well', async () => {
      respondWith(okJson('plain enough'));

      const res = await fetchFn('http://localhost/api/x');

      await expect(res.text()).resolves.toBe('plain enough');
      expect(res.bodyUsed).toBe(true);
      await expect(res.text()).rejects.toThrow(TypeError);
    });

    it('marks the body used through blob() as well', async () => {
      // `blob()` decodes the stored mock as base64; 'aGVsbG8=' is "hello".
      respondWith({ ...okJson('aGVsbG8='), headers: { 'content-type': 'application/octet-stream' } });

      const res = await fetchFn('http://localhost/api/x');
      const blob = await res.blob();

      await expect(blob.text()).resolves.toBe('hello');
      expect(res.bodyUsed).toBe(true);
      await expect(res.blob()).rejects.toThrow(TypeError);
    });

    it('survives clone(): the copy is readable on its own', async () => {
      respondWith(okJson());

      const res = await fetchFn('http://localhost/api/x');
      const copy = res.clone();

      await expect(res.json()).resolves.toEqual({ a: 1 });
      await expect(copy.json()).resolves.toEqual({ a: 1 });
    });

    it('consumes the cache entry at construction', async () => {
      respondWith(okJson());

      await fetchFn('http://localhost/api/x');

      expect(cache).toHaveLength(0);
    });

    it('agrees with itself about a mocked error status', async () => {
      respondWith({ ...okJson('oops'), statusCode: 503 });

      const res = await fetchFn('http://localhost/api/x');

      // `status` is a patched getter, so asserting it alone proves little;
      // `ok` reads the native slot and is the half that used to lie.
      expect(res.status).toBe(503);
      expect(res.ok).toBe(false);
    });

    it('builds a null-body status without a body, and without throwing', async () => {
      respondWith({ status: okStatus, statusCode: 204, headers: {}, response: '', delay: 0 });

      const res = await fetchFn('http://localhost/api/x');

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
    });

    it('rejects — not throws — when the mock is not valid JSON', async () => {
      respondWith(okJson('not json at all'));

      const res = await fetchFn('http://localhost/api/x');

      // The native `json()` never throws synchronously; its contract is a
      // rejected promise, and callers only wire up `.catch`.
      let threwSynchronously = false;
      let pending: Promise<unknown> | undefined;

      try {
        pending = res.json();
      } catch {
        threwSynchronously = true;
      }

      expect(threwSynchronously).toBe(false);
      await expect(pending).rejects.toThrow();
    });

    it('rejects — not throws — when a mock is not valid base64', async () => {
      respondWith({ ...okJson('!!! not base64 !!!'), headers: { 'content-type': 'image/png' } });

      const res = await fetchFn('http://localhost/api/x');

      let threwSynchronously = false;
      let pending: Promise<unknown> | undefined;

      try {
        pending = res.arrayBuffer();
      } catch {
        threwSynchronously = true;
      }

      expect(threwSynchronously).toBe(false);
      await expect(pending).rejects.toThrow();
    });
  });

  describe('a Request input keeps what the caller asked for', () => {
    it('sends the Request body to mock matching', async () => {
      respondWith(okJson());

      await fetchFn(new Request('http://localhost/api/x', { method: 'POST', body: 'PAYLOAD' }));

      expect(dispatchApiRequestMock.mock.calls[0][0]).toMatchObject({
        method: 'POST',
        body: 'PAYLOAD'
      });
    });

    it('leaves the Request readable after matching consulted its body', async () => {
      respondWith({ status: noContentStatus });

      const request = new Request('http://localhost/api/x', { method: 'POST', body: 'PAYLOAD' });

      await fetchFn(request);

      // The real fetch gets the original request; a consumed body would make
      // it fail with "body stream already read".
      expect(request.bodyUsed).toBe(false);
    });

    it('lets init members override the Request, per the fetch spec', async () => {
      respondWith(okJson());

      const request = new Request('http://localhost/api/x', {
        method: 'POST',
        headers: { 'x-from-request': '1' }
      });

      await fetchFn(request, { headers: { 'x-from-init': '1' } });

      expect(dispatchApiRequestMock.mock.calls[0][0].headers).toEqual({ 'x-from-init': '1' });
    });

    it('hands the real fetch the caller`s own init on passthrough', async () => {
      respondWith({ status: noContentStatus });

      const request = new Request('http://localhost/api/x', { method: 'POST', body: 'B' });
      const controller = new AbortController();
      const init = { signal: controller.signal, headers: { 'x-extra': '1' } };

      await fetchFn(request, init);

      // The very same objects — not a rebuilt init that lost `signal`,
      // `credentials`, `cache` and any body override on the floor.
      expect(originalFetchSpy).toHaveBeenCalledTimes(1);
      expect(originalFetchSpy.mock.calls[0][0]).toBe(request);
      expect(originalFetchSpy.mock.calls[0][1]).toBe(init);
    });
  });
});
