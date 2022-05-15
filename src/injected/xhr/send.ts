import { ohMyMockStatus, STORAGE_KEY } from "../../shared/constants";
import { IOhMyAPIRequest } from "../../shared/type";
import { dispatchApiRequest } from "../message/dispatch-api-request";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

// const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__send');
// const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'send');

// const send = window.XMLHttpRequest.prototype.send;

export function patchSend() {
  // Object.defineProperties(window.XMLHttpRequest.prototype, {
  // send: {
  // ...descriptor,
  // value: function (body) {
  window[STORAGE_KEY].xhr.send = function (body) {
    if (!window[STORAGE_KEY].state?.active) {
      return this.__send(body);
    }

    dispatchApiRequest({
      url: this.ohUrl,
      method: this.ohMethod,
      headers: this.ohHeaders,
      body
    } as IOhMyAPIRequest, 'XHR').then(async data => {
      if (data.response.status !== ohMyMockStatus.OK) { // No cache
        this.ohMyHasError = data.response.status === ohMyMockStatus.ERROR;

        this.addEventListener('load', async event => { // TODO: Should we do something with  `event`??
          // TODO: use requestType to determine what to do
          // const contentType = this.getResponseHeader('content-type');
          // console.log('CCCCCCCCCCCCC', contentType);
          // const headersStr =  this.getAllResponseHeaders();
          // const headers =  parse(headersStr);

          if (this.ohResult && this.ohResult.response.status !== ohMyMockStatus.OK) {
            this.ohResult = findCachedResponse({ url: this.ohUrl, method: this.ohMethod });
            persistResponse(this, this.ohResult.request);
          }
        });
        this.__send(body);
      } else {
        // if ((data.response as string).match(IS_BASE64_RE)) { // It is base64 => Blob
        // data.response = await toBlob(data.response as string);
        // }

        // injectResponse(this, data);

        setTimeout(() => {
          this.onreadystatechange?.();
          this.onload?.();

          const progressEvent = new ProgressEvent('load', { /* ....???.... */ });
          this.ohListeners.forEach(l => l(progressEvent));
        }, data.response.delay);
      }
    });
  }
  // },
  // __send: descriptor
  // });
}

export function unpatchSend() {
  // Object.defineProperty(window.XMLHttpRequest.prototype, 'send', descriptor);
  // delete window.XMLHttpRequest.prototype['__send'];
}
