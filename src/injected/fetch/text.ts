import { IOhMyResponseStatus, STORAGE_KEY } from "../../shared/constants";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.Response.prototype.hasOwnProperty('__text');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'text');

export function patchResponseText() {
  Object.defineProperties(window.Response.prototype, {
    text: {
      ...descriptor,
      value: async function () {
        if (!window[STORAGE_KEY].state.active) {
          return this.__text();
        }

        if (!this.ohResult) {
          this.oHResult = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            requestMethod: this.ohMethod
          });

          if (this.ohResult && this.ohResult.response.status !== IOhMyResponseStatus.OK) {
            persistResponse(this, this.ohResult.request);
          }
        }

        if (this.ohResult?.response.status === IOhMyResponseStatus.OK) {
          let output = this.ohResult.response?.response;
          if (typeof output !== 'string') {
            try {
              output = JSON.stringify(output);
            } catch (err) { /* not json */ }
          }
          return Promise.resolve(output);
        } else {
          return this.__text();
        }
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    __text: descriptor!
  });
}

export function unpatchResponseText() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Object.defineProperty(window.Response.prototype, 'text', descriptor!);
  delete window.Response.prototype['__text'];
}
