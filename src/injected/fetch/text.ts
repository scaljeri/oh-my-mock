import { ohMyMockStatus } from "../../shared/constants";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.Response.prototype.hasOwnProperty('__text');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'text');

export function patchResponseText() {
  Object.defineProperties(window.Response.prototype, {
    text: {
      ...descriptor,
      value: function () {
        if (!this.ohResult) {
          this.oHResult = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            method: this.ohMethod
          });
          // if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
          //   let output = this.ohResult.response?.response;
          //   if (typeof output !== 'string') {
          //     try {
          //       output = JSON.stringify(output);
          //     } catch (err) { /* not json */ }
          //   }
          //   return Promise.resolve(output);
          // }

          if (this.ohResult && this.ohResult.response.status !== ohMyMockStatus.OK) {
            persistResponse(this, this.ohResult.request);
          }

          // return this.__text();
        }

        console.log('TEXT 1');
        if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
          let output = this.ohResult.response?.response;
          if (typeof output !== 'string') {
            try {
              output = JSON.stringify(output);
            } catch (err) { /* not json */ }
          }
        console.log('TEXT 2');
          return Promise.resolve(output);
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
