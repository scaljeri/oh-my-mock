// TODO
import { IOhMyResponseStatus, STORAGE_KEY } from "../../shared/constants";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.Response.prototype.hasOwnProperty('__status');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'status');

export function patchStatus() {
  Object.defineProperties(window.Response.prototype, {
    status: {
      ...descriptor,
      get: function () {
        if (!window[STORAGE_KEY].state.active) {
          return this.__status;
        }

        if (!this.ohResult) {
          this.ohResult = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            requestMethod: this.ohMethod || 'GET'
          });
          if (this.ohResult && this.ohResult.response.status === IOhMyResponseStatus.OK) {
            return this.ohResult.response?.statusCode;
          } else {
            persistResponse(this, this.ohResult?.request);
            return this.__status;
          }
        } else if (this.ohResult && this.ohResult.response.status === IOhMyResponseStatus.OK) {
          return this.ohResult.response?.statusCode;
        } else {
          return this.__status;
        }
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    __status: descriptor!
  });
}

export function unpatchStatus() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Object.defineProperty(window.Response.prototype, 'status', descriptor!);
  delete window.Response.prototype['__status'];
}
