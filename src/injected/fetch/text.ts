import { ohMyMockStatus } from "../../shared/constants";
import { findCachedResponseAsync } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.Response.prototype.hasOwnProperty('__text');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'text');

export function patchResponseText() {
  Object.defineProperties(window.Response.prototype, {
    text: {
      ...descriptor,
      value: function () {
        if (!this.ohResult) {
          return findCachedResponseAsync({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            method: this.ohMethod
          }).then(result => {
            this.ohResult = result;
            if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
              return Promise.resolve(this.ohResult.response?.response);
            }

            if (this.ohResult && this.ohResult.response.status !== ohMyMockStatus.OK) {
              persistResponse(this, this.ohResult.request);
            }
          })
        }

        if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
          return Promise.resolve(this.ohResult.response?.response);
        } else {
          return this.__text();
        }
      }
    },
    __text: descriptor
  });
}

export function unpatchResponseText() {
  Object.defineProperty(window.Response.prototype, 'text', descriptor);
  delete window.Response.prototype['__text'];
}
