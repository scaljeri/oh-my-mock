import { ohMyMockStatus } from "../../shared/constants";
import { b64ToBlob } from "../../shared/utils/binary";
import { getMimeType } from "../../shared/utils/mime-type";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

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

          if (this.ohResult && this.ohResult.response.status !== ohMyMockStatus.OK) {
            persistResponse(this, this.ohResult.request);
          }
        }

        if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
          const response = this.ohResult.response?.response;
          const contentType = getMimeType(this.ohResult.headers);
          return Promise.resolve(b64ToBlob(response, contentType)); // TODO: Can this also be a normal string
        } else {
          return this.__blob();
        }
      }
    },
    __blob: descriptor
  });
}

export function unpatchResponseBlob() {
  Object.defineProperty(window.Response.prototype, 'blob', descriptor);
  delete window.Response.prototype['__blob'];
}
