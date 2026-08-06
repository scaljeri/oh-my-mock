import { requestMethod } from '../shared/types/request';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { ohMyMockStatus } from '../shared/constants';
import { ohMyWindow } from '../shared/oh-my-window';
import { isMockingActive } from './active-state';
import { patchResponseBlob, unpatchResponseBlob } from './fetch/blob';
import { patchHeaders, unpatchHeaders } from './fetch/headers';
import { patchResponseArrayBuffer, unpatchResponseArrayBuffer } from './fetch/arraybuffer';
import { patchResponseJson, unpatchResponseJson } from './fetch/json';
import { patchResponseText, unpatchResponseText } from './fetch/text';
import { patchStatus, unpatchStatus } from './fetch/status';
import { asOhMyResponse } from './fetch/oh-my-response';
import { persistResponse } from './fetch/persist-response';
import { error, findCachedResponse } from './utils';

/**
 * The unpatched `fetch`, saved by `src/early-inject` before any page script
 * could take a reference to it.
 *
 * It is always there — the injected bundle only runs once early-inject has
 * created the namespace — but the shared type marks it optional because the
 * content script's copy of the namespace has no fetch in it.
 */
function originalFetch(): typeof fetch {
  const fn = ohMyWindow().__fetch;

  if (!fn) {
    throw new Error('OhMyMock: the original fetch is gone, cannot forward this request');
  }

  return fn;
}

/**
 * `fetch`'s second argument as it arrives from the page: early-inject forwards
 * whatever the caller passed, which need not be an object at all.
 */
function toRequestInit(init: unknown): RequestInit {
  return typeof init === 'object' && init !== null ? init as RequestInit : {};
}

/**
 * What the request's body would read as, for matching and recording.
 *
 * Reads a *clone*: the original has to stay readable for the real `fetch` when
 * the request turns out not to be mocked. A body that is already consumed, or a
 * stream that cannot be cloned, matches without a body rather than failing the
 * request over bookkeeping.
 */
async function requestBodyText(request: Request): Promise<string | undefined> {
  if (!request.body || request.bodyUsed) {
    return undefined;
  }

  try {
    return await request.clone().text();
  } catch {
    return undefined;
  }
}

async function ohMyFetch(request: string | Request, init?: unknown): Promise<unknown> {
  // Never modified below: this exact object goes back out to the real `fetch`
  // on the passthrough path, so the caller's `signal`, `credentials`, `cache`
  // and friends survive whether or not the request is mocked. It used to be
  // *replaced* when the input was a `Request` — reduced to `{ headers, method }`
  // — which handed the real fetch an init that cancelled the caller's own
  // overrides, and dropped their `signal` outright.
  const config = toRequestInit(init);

  // Waits for the verdict rather than reading an absent state as "off". This
  // runs before the content script has finished reading `chrome.storage`, and
  // letting the call through in the meantime is exactly how an on-load request
  // escaped. Once decided this is a resolved promise and costs a microtask.
  if (!(await isMockingActive())) {
    return originalFetch().call(window, request, config);
  }

  // The fields a mock is matched on. Per the fetch spec an `init` member
  // accompanies — and overrides — whatever the `Request` carries, so `config`
  // wins wherever it says something.
  let url: string;
  let headersInit: HeadersInit | undefined | null;
  let body: unknown;

  if (request instanceof Request) {
    url = request.url;
    headersInit = config.headers ?? request.headers;
    // `?? undefined`: `init.body: null` means "no body", not "read the
    // Request's".
    body = config.body ?? await requestBodyText(request);
  } else {
    url = request;
    headersInit = config.headers;
    body = config.body;
  }

  // A FormData body is flattened into a plain object so it survives being
  // posted to the content script. That copy is kept *beside* `config` rather
  // than written back into it: `config` is handed to the real fetch further
  // down when the request turns out not to be mocked, and a plain object body
  // would go out as the string "[object Object]", without a multipart boundary.
  if (body instanceof FormData) {
    const fd: Record<string, FormDataEntryValue> = {};
    body.forEach((value, key) => fd[key] = value);
    body = fd;
  }

  // The method can arrive two ways: in `config`, or on a `Request` object
  // passed as the first argument — `fetch(new Request(url, { method: 'POST' }))`
  // reported GET while only `config` was consulted, so a mock stored for the
  // real method never matched.
  //
  // `toUpperCase()` widens to `string`, so the cast is needed — and it trusts
  // the page, which may pass any method it likes. That is fine: a method
  // outside `METHODS` never matches a stored mock, and an unmatched request
  // passes through to the real server, which is the only sensible outcome for
  // a request no mock could have been created for.
  const method = (
    config.method ||
    (request instanceof Request ? request.method : '') ||
    'get'
  ).toUpperCase() as requestMethod;

  const result = await dispatchApiRequest({
    url,
    method,
    requestType: 'FETCH',
    headers: fetchUtils.headersToJson(headersInit),
    ...(body !== undefined && { body })
  }, 'FETCH');

  const { status, statusCode, delay } = result.response;

  if (status === ohMyMockStatus.ERROR) {
    error('Ooops, something went wrong while mocking your FETCH request!')
  }

  if (status !== ohMyMockStatus.OK) {
    return originalFetch().call(window, request, config).then(async (response: Response) => {
      const ohResponse = asOhMyResponse(response);
      ohResponse.ohResult = await persistResponse(ohResponse, result.request);

      return ohResponse;
    });
  }

  return new Promise(resolve => {
    // Build the Response with the mocked status rather than defaulting to 200
    // and overriding the `status` getter afterwards. `ok` and `statusText` are
    // native getters reading the same internal slot, and they cannot be patched
    // into agreement — a bare `new Response()` would keep reporting `ok: true`
    // for a mocked 500, so `if (!res.ok) throw` would never fire.
    //
    // The same argument decides the *body*: `bodyUsed`, the `body` stream and —
    // above all — `clone()` read internal slots too. Built over `null`, the
    // response was an empty shell that only answered through the patched
    // prototype readers, so `res.body` was `null`, `bodyUsed` never became
    // true, and a clone (which starts with no `ohUrl` and an empty `url`)
    // choked on a body that was never there. The stored mock *is* the body.
    const responseStatus = toValidResponseStatus(statusCode);
    const resp = asOhMyResponse(new Response(
      // 204/205/304 are null-body statuses; the constructor throws when they
      // are given one, however empty.
      hasNullBodyStatus(responseStatus) ? null : toResponseBodyText(result.response.response),
      { status: responseStatus, headers: result.response.headers ?? {} }
    ));

    resp.ohUrl = url;
    resp.ohMethod = method;
    // The verdict travels on the instance, not through another cache lookup:
    // the entry is consumed here, so a later request to the same url cannot be
    // answered with this response's leftovers.
    resp.ohResult = findCachedResponse({ url, method }) ?? result;

    // `Response.url` reflects an internal slot the constructor cannot set, so a
    // mocked response reported `''` where every real one reports the request
    // url. An own data property shadows the prototype getter.
    Object.defineProperty(resp, 'url', { value: url });

    setTimeout(() => resolve(resp), delay || 0);
  });
}

// The Response constructor throws a RangeError outside 200-599, so a mock with
// a missing or nonsensical status code falls back to 200 instead of breaking
// the request it was meant to serve.
function toValidResponseStatus(statusCode: unknown): number {
  const code = Number(statusCode);

  return Number.isInteger(code) && code >= 200 && code <= 599 ? code : 200;
}

/** The statuses the fetch spec forbids a body for. */
function hasNullBodyStatus(status: number): boolean {
  return status === 204 || status === 205 || status === 304;
}

/**
 * The stored mock as `Response` body material.
 *
 * Mocks are stored as text (`IMock.response` is a string), but custom response
 * code is free to return an object, and text-reading callers get it
 * JSON-stringified (see `fetch/text.ts`) — the body has to say the same thing.
 * A binary mock is stored as *base64* text and is served decoded by the patched
 * `blob()`/`arrayBuffer()`; the raw stream underneath carries the base64 form,
 * which is only observable by reading a clone's body natively. That is the
 * price of not guessing: nothing in a stored mock says reliably whether its
 * text is base64 or content that merely looks like it.
 */
function toResponseBodyText(response: unknown): string | null {
  if (response === undefined || response === null) {
    return null;
  }

  if (typeof response === 'string') {
    return response;
  }

  try {
    return JSON.stringify(response);
  } catch {
    // Not serialisable (a cycle, a BigInt) — the patched readers still serve
    // the value itself; the raw stream falls back to its string form.
    return String(response);
  }
}

function patchFetch(): void {
  ohMyWindow().fetch = ohMyFetch;
  patchResponseBlob();
  patchResponseArrayBuffer();
  patchResponseJson();
  patchResponseText();
  patchHeaders();
  patchStatus();
}

function unpatchFetch(): void {
  // Was `XMLHttpRequest.prototype['__fetch']`, which nothing ever sets — the
  // original fetch is saved on the OhMyMock namespace by early-inject. With the
  // XHR prototype being asked instead, the condition was always false and
  // `window[STORAGE_KEY].unpatch()` restored none of the Response patches.
  if (ohMyWindow().__fetch) {
    unpatchResponseBlob();
    unpatchResponseArrayBuffer();
    unpatchResponseJson();
    unpatchResponseText();
    unpatchHeaders();
    unpatchStatus();
  }
}

export { unpatchFetch, patchFetch };
