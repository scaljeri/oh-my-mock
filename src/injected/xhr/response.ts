import { findCachedResponse } from "../utils";

const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'response');

export function patchResponse() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'response', {
    ...descriptor,
    get: function () {
      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          method: this.ohMethod
        });
      }

      return this.ohResult?.response?.response || this.__response;
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__response', { ...descriptor });
}

export function unpatchResponse() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'response', descriptor);
  delete window.XMLHttpRequest.prototype['__response'];
}

// function initResult(xhr) {
//   const url = (xhr.ohUrl || xhr.responseURL).replace(window.origin, '');

//   return findCachedResponse({
//     url,
//     method: xhr.ohMethod,
//     requestType: 'XHR'
//   });

//   // TODO: populate ohResponse, ohResponseText, ohStatus and ohHeaders
// }
