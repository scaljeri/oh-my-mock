import { STORAGE_KEY } from '../shared/constants';
import { IOhMyReadyResponse } from '../shared/packet-type';
import { requestMethod } from '../shared/type';

/**
 * An `XMLHttpRequest` as OhMyMock's patches see it.
 *
 * Two scripts patch the prototype. `src/early-inject/index.ts` runs at
 * `document_start`, before any page code can hold a reference, and wraps
 * `open`, `send`, `setRequestHeader` and `addEventListener`. The injected
 * bundle then wraps the `status` / `response` / `responseText` / header
 * members. Both keep the untouched original under a `__`-prefixed name, and
 * both hang request bookkeeping off the instance under `oh`-prefixed names.
 *
 * Every patched function therefore runs with `this` set to an object of this
 * shape, which is why they declare `this: IOhMyXhr` instead of asserting on
 * each property access.
 */
export interface IOhMyXhr extends XMLHttpRequest {
  /** Url as handed to `open`, so still including the origin. */
  ohUrl?: string;

  /** Method as handed to `open`, uppercased. */
  ohMethod?: requestMethod;

  /** Request headers collected by the `setRequestHeader` patch. */
  ohHeaders?: Record<string, string>;

  /**
   * `load` listeners registered through `addEventListener`.
   *
   * A mocked request never reaches the network, so no real `load` event is
   * ever dispatched; the `send` patch replays this list itself.
   */
  ohListeners?: EventListenerOrEventListenerObject[];

  /** What the extension decided to do with this request. */
  ohResult?: IOhMyReadyResponse;

  /** Set once the real response has been reported back to the extension. */
  __ohIsPerisisted?: boolean;

  /** Set when the extension answered with `ohMyMockStatus.ERROR`. */
  __ohMyHasError?: boolean;

  // The untouched originals. Each is installed by the patch that shadows the
  // member of the same name, so inside a patched function its own backup is
  // always present.
  __open: XMLHttpRequest['open'];
  __send: XMLHttpRequest['send'];
  __setRequestHeader: XMLHttpRequest['setRequestHeader'];
  __addEventListener: XMLHttpRequest['addEventListener'];
  __getAllResponseHeaders: XMLHttpRequest['getAllResponseHeaders'];
  __getResponseHeader: XMLHttpRequest['getResponseHeader'];
  __status: number;
  __responseText: string;
  /**
   * The real `response`. `XMLHttpRequest.response` is `any` because its type
   * depends on `responseType`; narrowing that to `unknown` here keeps the
   * callers honest about checking what they got.
   */
  __response: unknown;
}

/**
 * `XMLHttpRequest.prototype` as the patches see it.
 *
 * The backups are absent until the matching `patchX` has run and `unpatchX`
 * deletes them again, so unlike on an instance they are all optional here.
 */
export type IOhMyXhrPrototype = XMLHttpRequest & Partial<Pick<IOhMyXhr,
  '__open' | '__send' | '__setRequestHeader' | '__addEventListener' |
  '__getAllResponseHeaders' | '__getResponseHeader' |
  '__status' | '__responseText' | '__response'>>;

/**
 * The prototype every patch installs onto. The `__`-prefixed members are an
 * OhMyMock convention the DOM typings know nothing about, so this is the one
 * place that states the relation.
 */
export function ohMyXhrPrototype(): IOhMyXhrPrototype {
  return window.XMLHttpRequest.prototype as IOhMyXhrPrototype;
}

/**
 * The descriptor of a member OhMyMock patches.
 *
 * `getOwnPropertyDescriptor` is typed as possibly returning `undefined`, but
 * every member patched here is an own property of `XMLHttpRequest.prototype`
 * in every browser. Throwing beats defining a property from `undefined`, which
 * would silently replace the member with a non-writable `undefined`.
 */
export function xhrDescriptor(name: string): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, name);

  if (!descriptor) {
    throw new Error(`${STORAGE_KEY}: XMLHttpRequest.prototype has no own '${name}'`);
  }

  return descriptor;
}

/**
 * An `XMLHttpRequest` that has been through the patched `open`.
 *
 * `IOhMyWindow.xhr.send` declares its `this` as a plain `XMLHttpRequest`,
 * because `src/shared` cannot depend on `src/injected`. `send` can only be
 * reached through the patch in `src/early-inject`, which runs `open` first, so
 * the instance really does carry the members below.
 */
export function asOhMyXhr(xhr: XMLHttpRequest): IOhMyXhr {
  return xhr as IOhMyXhr;
}

/**
 * `BufferSource` excludes views backed by a `SharedArrayBuffer`, which
 * `ArrayBuffer.isView` happily accepts, so the backing buffer is checked too.
 */
function isBufferSource(body: unknown): body is BufferSource {
  return body instanceof ArrayBuffer ||
    (ArrayBuffer.isView(body) && body.buffer instanceof ArrayBuffer);
}

/**
 * The body the page passed to `send`, as the real `send` accepts it.
 *
 * The patched `send` is reached through `IOhMyWindow.xhr.send`, which types the
 * body as `unknown`. This mirrors what the browser does with the IDL union:
 * a `Document` or an `XMLHttpRequestBodyInit` is passed straight through,
 * anything else is stringified.
 */
export function toXhrBody(body: unknown): Document | XMLHttpRequestBodyInit | null {
  if (body === null || body === undefined) {
    return null;
  }

  if (typeof body === 'string' || body instanceof Blob || body instanceof FormData ||
    body instanceof URLSearchParams || body instanceof Document || isBufferSource(body)) {
    return body;
  }

  return String(body);
}
