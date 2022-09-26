import { IOhMyResponseStatus, STORAGE_KEY } from "../../shared/constants";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.Response.prototype.hasOwnProperty('__json');
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'json')!;

export function patchResponseJson() {
  Object.defineProperties(window.Response.prototype, {
    json: {
      ...descriptor,
      value: function () {
        if (!window[STORAGE_KEY].state.active) {
          return this.__json();
        }

        if (!this.ohResult) {
          this.ohResult = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            requestMethod: this.ohMethod
          });

          if (this.ohResult && this.ohResult.response.status !== IOhMyResponseStatus.OK) {
            persistResponse(this, this.ohResult.request);
          }
        }

        if (this.ohResult && this.ohResult.response.status === IOhMyResponseStatus.OK) {
          const response = this.ohResult.response?.response;
          return Promise.resolve(typeof response === 'string' ? JSON.parse(response) : response);
        } else {
          return this.__json();
        }

      }
    },
    __json: descriptor
  });
}

export function unpatchResponseJson() {
  Object.defineProperty(window.Response.prototype, 'json', descriptor);
  delete window.Response.prototype['__json'];
}
