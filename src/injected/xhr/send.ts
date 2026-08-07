import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyAPIRequest } from "../../shared/types/api-request";
import { dispatchApiRequest } from "../message/dispatch-api-request";
import { asOhMyXhr, toXhrBody } from "../oh-my-xhr";
import { error, findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

// const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__send');
// const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'send');

// const send = window.XMLHttpRequest.prototype.send;

export function patchSend() {
  // `send` itself is patched by `installEntryPoints`, in the first statement
  // this bundle runs — before any page script can grab a reference to the
  // original. It forwards here as soon as this publishes.
  ohMyWindow().xhr = {
    /**
     * **Synchronous**, always, and that is not a detail.
     *
     * `XMLHttpRequest.send` is expected to have acted by the time it returns;
     * making it `async` pushed the real send a microtask out and made the plain
     * XHR mocking test fail intermittently. It used to await the verdict on the
     * first calls of a page — there is no verdict to wait for now, because this
     * bundle is only on a page whose host is switched on.
     */
    send: function (this: XMLHttpRequest, body?: unknown) {
      sendNow(this, body);
    }
  };

  function sendNow(self: XMLHttpRequest, body?: unknown): void {
    {
      const xhr = asOhMyXhr(self);
      const url = xhr.ohUrl;
      const method = xhr.ohMethod;

      // `open` records both before `send` can run; without them there is
      // nothing to match a mock against, so let the request through.
      if (!ohMyWindow().state?.active || !url || !method) {
        // `__send` is taken off the prototype when the patches are handed back.
        // A request already dispatched when that happens still has to go
        // somewhere, so the namespace keeps a copy. Whichever of the two this
        // call finds, it goes out.
        const send = xhr.__send ?? ohMyWindow().__xhrSend;

        send?.call(xhr, toXhrBody(body));

        return;
      }

      const request: IOhMyAPIRequest = {
        url,
        method,
        requestType: 'XHR',
        headers: xhr.ohHeaders ?? {},
        body
      };

      dispatchApiRequest(request, 'XHR').then(data => {
        if (data.response.status !== ohMyMockStatus.OK) { // No cache
          xhr.__ohMyHasError = data.response.status === ohMyMockStatus.ERROR;

          if (!xhr.__ohMyHasError) {

            xhr.addEventListener('load', () => {
              // TODO: use requestType to determine what to do
              // const contentType = xhr.getResponseHeader('content-type');
              // const headersStr =  xhr.getAllResponseHeaders();
              // const headers =  parse(headersStr);

              const pending = xhr.ohResult;

              if (pending && pending.response.status !== ohMyMockStatus.OK) {
                // A newer decision may have arrived while the request was in
                // flight; fall back to the one we already have.
                const result = findCachedResponse({ url, method }) ?? pending;

                xhr.ohResult = result;
                persistResponse(xhr, result.request);
              }
            });
          }

          // The same fallback as on the synchronous path above, and for a
          // reason that is now ordinary rather than exotic: this request was
          // dispatched while the answer was still coming, and a `false` verdict
          // arriving in the meantime takes `__send` off the prototype
          // (`restore-originals.ts`). Reaching for it and finding nothing threw
          // inside this promise, whose `catch` only logs — the request was
          // never sent, never failed, and the page's XHR simply never
          // completed.
          //
          // The registration used to drop the port, so the bundle landed on
          // every port of a mocked host and the ones that were *not* mocked
          // took exactly this path on their first request — which is how the
          // fallback came to be needed. It carries the port now, so that source
          // is gone; a domain switched off while its page is open still gets
          // here, and the fallback stays because losing this race costs the
          // page a request that never completes at all.
          const send = xhr.__send ?? ohMyWindow().__xhrSend;

          send?.call(xhr, toXhrBody(body));
        } else {
          // The request never leaves the page, so the events the network would
          // have produced are synthesised here. `loadstart` goes out before the
          // mock's delay — the request "starts" now, the response arrives later
          // — and could not go out earlier: at `send` time nobody knows yet
          // whether this call will be mocked or handed to the real `send`,
          // which fires its own.
          xhr.dispatchEvent(new ProgressEvent('loadstart'));

          setTimeout(() => completeMockedRequest(xhr, data.response.response), data.response.delay);
        }
      }).catch(err => {
        // Nothing below this point runs, which means the page's XHR never
        // completes and, if the rejection came early, was never even sent. That
        // used to happen without a word in the console.
        error(`OhMyMock could not mock ${method} ${url}; the request is stuck`, err);
      });
    }
  }
}

/**
 * Walks the instance through the readyState/event sequence of a successful
 * response, exactly as the network would have: readystatechange for
 * HEADERS_RECEIVED and LOADING, a `progress` event, readystatechange for DONE,
 * then `load` and finally `loadend`.
 *
 * Everything goes through `dispatchEvent` on the instance itself. The events
 * used to be built by hand and pushed into `onreadystatechange`/`onload` plus a
 * list of captured listeners, and that shape was wrong three ways at once:
 * `addEventListener('readystatechange')` and every `loadend` listener were
 * simply never called — axios ≥ 1.x settles its promise in `loadend`, so a
 * mocked request through it never resolved — and the events had no `target`,
 * so the extremely common `e.target.readyState` threw. An XHR is a real
 * `EventTarget`; dispatching on it runs the handler properties *and* every
 * registered listener, honours `once`/`capture`/`signal`, respects
 * `removeEventListener`, and stamps `target`/`currentTarget` on the way.
 *
 * `error`, `timeout` and `abort` are deliberately not synthesised: a mocked
 * request cannot fail in transit, so — like a real request that succeeds —
 * those events never fire. (`abort()` during the mock's delay is not detected;
 * the response is already decided and arrives regardless.)
 */
function completeMockedRequest(xhr: XMLHttpRequest, body: unknown): void {
  // `configurable` on every step: the shim's `open` deletes this shadow when
  // the instance is reused, and without it the delete would throw and the
  // instance be stuck at DONE.
  const setReadyState = (value: number): void => {
    Object.defineProperty(xhr, 'readyState', { value, configurable: true });
    xhr.dispatchEvent(new Event('readystatechange'));
  };

  // A mock's body is stored as text, so its size is knowable; anything else is
  // reported the way the network reports an opaque length.
  const total = typeof body === 'string' ? new Blob([body]).size : 0;
  const sizes = { lengthComputable: typeof body === 'string', loaded: total, total };

  setReadyState(XMLHttpRequest.HEADERS_RECEIVED);
  setReadyState(XMLHttpRequest.LOADING);
  xhr.dispatchEvent(new ProgressEvent('progress', sizes));
  setReadyState(XMLHttpRequest.DONE);
  xhr.dispatchEvent(new ProgressEvent('load', sizes));
  xhr.dispatchEvent(new ProgressEvent('loadend', sizes));
}

export function unpatchSend() {
  // Object.defineProperty(window.XMLHttpRequest.prototype, 'send', descriptor);
  // delete window.XMLHttpRequest.prototype['__send'];
}
