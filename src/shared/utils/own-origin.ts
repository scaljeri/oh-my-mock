/**
 * This document's own origin, and how to address its own window with it.
 *
 * `window.origin` and `window.location.origin` are not the same thing, and the
 * difference is invisible until it is not. `location.origin` is derived from
 * the *url*: on `http://example.com/x` it is always `"http://example.com"`.
 * `window.origin` is the *document's* origin, which a `Content-Security-Policy:
 * sandbox` header (or a sandboxed iframe) makes opaque — `"null"` — while the
 * url, and therefore `location.origin`, goes on reading `"http://example.com"`.
 *
 * That gap silently broke every message OhMyMock sends between the page context
 * and the content script on such a page. `postMessage` delivers only if the
 * `targetOrigin` matches the *receiving document's* origin, so posting to
 * `location.origin` on a sandboxed page addressed `"http://example.com"` at a
 * window whose origin is `"null"`, and the message was dropped without an error
 * anywhere. The page-context bundle went on installing itself and reporting
 * `window.OhMyMock.version`, so it looked injected; the content script simply
 * never heard a request and never answered one, and every call the page made
 * fell through to the real server after the backstop timeout. A mocked
 * endpoint quietly hit the network.
 *
 * `"null"` cannot be used as a `targetOrigin` either — `postMessage` throws
 * `SyntaxError: Invalid target origin 'null'` — so an opaque document has to be
 * addressed with `'*'`. That is not the hole it looks like: the receiver in
 * `trigger-msg-window.ts` requires `event.source === window`, which is what
 * actually keeps other frames out, and a document with an opaque origin has no
 * origin to check against in the first place.
 */

/**
 * The document's origin as `MessageEvent.origin` will report it — `"null"` when
 * it is opaque. Use this, never `location.origin`, to check where a message
 * came from.
 */
export function ownOrigin(): string {
  return window.origin;
}

/**
 * The `postMessage` target origin for this document's own window.
 *
 * `'*'` only where there is no origin to name: an opaque document, or a browser
 * that leaves `window.origin` empty.
 */
export function ownWindowTarget(): string {
  const origin = ownOrigin();

  return !origin || origin === 'null' ? '*' : origin;
}
