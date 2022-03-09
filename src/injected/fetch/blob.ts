import { ohMyMockStatus } from "../../shared/constants";
import { b64ToBlob } from "../../shared/utils/binary";
import { findCachedResponse } from "../utils";

const isPatched = !!window.Response.prototype.hasOwnProperty('__blob');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'blob');

export function patchResponseBlob() {
  Object.defineProperties(window.Response.prototype, {
    blob: {
      ...descriptor,
      value: function () {
        if (!this.ohResult) {
          this.ohResult = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            method: this.ohMethod
          });
        }

        if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
          const response = this.ohResult.response?.response;
          const contentType = this.ohResult.headers['content-type'];
          return Promise.resolve(b64ToBlob(response, contentType));
        } else {
          return this.__blob();
        }
      }
    },
    __blob: descriptor
  });
}

export function unpatchResponseBlob() {
  Object.defineProperty(window.Response.prototype, 'json', descriptor);
  delete window.Response.prototype['__json'];
}
