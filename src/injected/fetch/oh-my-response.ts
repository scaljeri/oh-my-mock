import { IOhMyReadyResponse, IOhMyResponseUpdate } from '../../shared/packet-type';
import { requestMethod } from '../../shared/type';

/**
 * What `ohResult` holds — the two are *not* the same shape, and which one is
 * there depends on who put it there:
 *
 * - `IOhMyReadyResponse` is a mock the extension prepared for this request,
 *   taken from the cache by whichever accessor (`status`, `headers`, a body
 *   reader) the page touched first. It carries an `ohMyMockStatus`.
 * - `IOhMyResponseUpdate` is the record `persistResponse` writes back after
 *   sending a *real* response to the background script. It has no status.
 *
 * `isReadyResponse` is the only place allowed to tell them apart.
 */
export type IOhMyResult = IOhMyReadyResponse | IOhMyResponseUpdate;

/**
 * A `Response` as the fetch patches see it.
 *
 * `patchFetch` replaces `blob`, `text`, `json`, `arrayBuffer`, `headers` and
 * `status` on `Response.prototype` and keeps the originals under a `__` name, so
 * every `Response` in the page has these members — the DOM lib just does not
 * know about them. `ohUrl`/`ohMethod` are stamped on by `ohMyFetch` because a
 * mocked `Response` is built from scratch and its `url` is empty.
 */
export interface IOhMyResponse extends Response {
  ohResult?: IOhMyResult;
  ohUrl?: string;
  ohMethod?: requestMethod;

  // The saved originals. Non-optional: they are installed by the same
  // `defineProperties` call that installs the accessors reaching for them, so
  // inside a patched accessor they cannot be absent.
  __arrayBuffer(): Promise<ArrayBuffer>;
  __blob(): Promise<Blob>;
  __json(): Promise<unknown>;
  __text(): Promise<string>;
  readonly __headers: Headers;
  readonly __status: number;
}

/**
 * Every `Response` in the page has been through `patchFetch`, so this is where
 * that knowledge enters the type system.
 */
export function asOhMyResponse(response: Response): IOhMyResponse {
  return response as IOhMyResponse;
}

/** Whether `ohResult` is a mock lookup rather than a persisted-response record. */
export function isReadyResponse(result?: IOhMyResult): result is IOhMyReadyResponse {
  return !!result?.response && 'status' in result.response;
}

export type patchableResponseMember =
  'arrayBuffer' | 'blob' | 'headers' | 'json' | 'status' | 'text';

/**
 * The descriptor a patch has to preserve and reinstall.
 *
 * When the member has already been patched the original lives on under its `__`
 * name, so re-injecting the extension does not save the patch as the original.
 * Either way the descriptor exists — `blob`, `status`, … are own properties of
 * `Response.prototype` wherever `fetch` exists — and a missing one is a broken
 * environment rather than something to patch around: `Object.defineProperties`
 * would fail on `undefined` a moment later anyway, with a far worse message.
 */
export function originalDescriptor(name: patchableResponseMember): PropertyDescriptor {
  const saved = `__${name}`;
  const isPatched = Object.prototype.hasOwnProperty.call(window.Response.prototype, saved);
  const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, isPatched ? saved : name);

  if (!descriptor) {
    throw new Error(`OhMyMock: Response.prototype.${name} is missing, cannot patch fetch`);
  }

  return descriptor;
}
