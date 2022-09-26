import { IOhMyResponseStatus, STORAGE_KEY } from "../../shared/constants";
import { findCachedResponse } from "../utils";
import * as fetchUtils from '../../shared/utils/fetch';
import { persistResponse } from "./persist-response";

const isPatched = !!window.Response.prototype.hasOwnProperty('__headers');
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'headers')!;

export function patchHeaders() {
  Object.defineProperties(window.Response.prototype, {
    headers: {
      ...descriptor,
      get: function () {
        if (!window[STORAGE_KEY].state.active) {
         return this.__headers;
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
          return fetchUtils.jsonToHeaders(this.ohResult.response.headers);
        } else {
          return this.__headers;
        }
      }
    },
    __headers: descriptor
  });
}

export function unpatchHeaders() {
  Object.defineProperty(window.Response.prototype, 'headers', descriptor);
  delete window.Response.prototype['__headers'];
}
