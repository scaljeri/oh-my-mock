import { ohMyMockStatus } from "../../shared/constants";
import { findCachedResponse, findCachedResponsesync } from "../utils";

const isPatched = !!window.Response.prototype.hasOwnProperty('__text');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'text');

export function patchResponseText() {
  Object.defineProperties(window.Response.prototype, {
    text: {
      ...descriptor,
      value: function () {
        console.log('YYYYYYYYYYYYYYY');
        if (!this.ohResult) {
          return findCachedResponsesync({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            method: this.ohMethod
          }).then(result => {
            this.ohResult = result;
            if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
              return Promise.resolve(this.ohResult.response?.response);
            } else {
              return this.__text();
            }
          })
        } else if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
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
