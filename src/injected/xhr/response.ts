import { ohMyMockStatus } from "../../shared/constants";
import { b64ToArrayBuffer, b64ToBlob } from "../../shared/utils/binary";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__response');
const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'response');

export function patchResponse() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'response', {
    ...descriptor,
    get: function () {
      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          method: this.ohMethod
        });

        if (this.ohResult && this.ohResult.response.status !== ohMyMockStatus.OK) {
          persistResponse(this, this.ohResult.request);
        }
      }

      if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
        let response = this.ohResult.response?.response;
        if (this.responseType === 'blob') {
          response = b64ToBlob(response);
        } else if (this.responseType === 'arraybuffer') {
          response = b64ToArrayBuffer(response);
        } else if (this.responseType === 'json' && typeof response === 'string') {
          response = JSON.parse(response);
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
