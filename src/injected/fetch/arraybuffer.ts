import { ohMyMockStatus, STORAGE_KEY } from "../../shared/constants";
import { b64ToArrayBuffer } from "../../shared/utils/binary";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.Response.prototype.hasOwnProperty('__arrayBuffer');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'arrayBuffer');

export function patchResponseArrayBuffer() {
  Object.defineProperties(window.Response.prototype, {
    arrayBuffer: {
      ...descriptor,
      value: function () {
        if (!window[STORAGE_KEY].state.active) {
          return this.__arrayBuffer();
        }

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
          return Promise.resolve(b64ToArrayBuffer(response));
        } else {
          return this.__arrayBuffer();
        }
      }
    },
    __arrayBuffer: descriptor
  });
}

export function unpatchResponseArrayBuffer() {
  Object.defineProperty(window.Response.prototype, 'arrayBuffer', descriptor);
  delete window.Response.prototype['__arrayBuffer'];
}
