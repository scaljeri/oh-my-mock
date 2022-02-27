import { ohMyMockStatus } from "../../shared/constants";
import { b64ToArrayBuffer, b64ToBlob } from "../../shared/utils/binary";
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

      if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
        let response = this.ohResult.response?.response;
        if (this.responseType === 'blob') {
          response = b64ToBlob(response);
        } else if (this.responseType === 'arraybuffer') {
          response = b64ToArrayBuffer(response);
        }

        return response;
      }

      return this.__response;
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
