import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyAPIRequest } from "../../shared/type";
import { dispatchApiRequest } from "../message/dispatch-api-request";
import { asOhMyXhr, toXhrBody } from "../oh-my-xhr";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

// const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__send');
// const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'send');

// const send = window.XMLHttpRequest.prototype.send;

export function patchSend() {
  // `send` itself is patched in `src/early-inject`, which runs before any page
  // script can grab a reference to the original. It forwards to this function
  // as soon as the injected bundle has published it.
  ohMyWindow().xhr = {
    send: function (this: XMLHttpRequest, body?: unknown) {
      const xhr = asOhMyXhr(this);
      const url = xhr.ohUrl;
      const method = xhr.ohMethod;

      // `open` records both before `send` can run; without them there is
      // nothing to match a mock against, so let the request through.
      if (!ohMyWindow().state?.active || !url || !method) {
        return xhr.__send(toXhrBody(body));
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
          xhr.__send(toXhrBody(body));
        } else {
          // if ((data.response as string).match(IS_BASE64_RE)) { // It is base64 => Blob
          // data.response = await toBlob(data.response as string);
          // }

          // injectResponse(xhr, data);

          setTimeout(() => {
            // `configurable` on every step: without it the instance is stuck
            // at DONE and a second `open`/`send` on the same object throws.
            Object.defineProperty(xhr, 'readyState', { value: XMLHttpRequest.HEADERS_RECEIVED, configurable: true })
            xhr.onreadystatechange?.(new Event('readystatechange'));
            Object.defineProperty(xhr, 'readyState', { value: XMLHttpRequest.LOADING, configurable: true })
            xhr.onreadystatechange?.(new Event('readystatechange'));
            Object.defineProperty(xhr, 'readyState', { value: XMLHttpRequest.DONE, configurable: true })
            xhr.onreadystatechange?.(new Event('readystatechange'));

            const progressEvent = new ProgressEvent('load', { /* ....???.... */ });
            xhr.onload?.(progressEvent);

            xhr.ohListeners?.forEach(l =>
              typeof l === 'function' ? l(progressEvent) : l.handleEvent(progressEvent));
          }, data.response.delay);
        }
      }).catch(err => {
      });
    }
  }
}

export function unpatchSend() {
  // Object.defineProperty(window.XMLHttpRequest.prototype, 'send', descriptor);
  // delete window.XMLHttpRequest.prototype['__send'];
}
