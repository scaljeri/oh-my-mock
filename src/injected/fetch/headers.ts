import { ohMyMockStatus } from "../../shared/constants";
import { findCachedResponse } from "../utils";
import * as fetchUtils from '../../shared/utils/fetch';

const isPatched = !!window.Response.prototype.hasOwnProperty('__headers');
const descriptor = Object.getOwnPropertyDescriptor(window.Response.prototype, (isPatched ? '__' : '') + 'headers');

export function patchHeaders() {
  Object.defineProperties(window.Response.prototype, {
    headers: {
      ...descriptor,
      get: function () {
        if (!this.ohResult) {
          this.ohResult = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            method: this.ohMethod
          });
        }

        if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
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
