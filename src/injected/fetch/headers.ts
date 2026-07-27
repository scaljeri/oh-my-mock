import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyReadyResponse } from "../../shared/packet-type";
import { findCachedResponse } from "../utils";
import * as fetchUtils from '../../shared/utils/fetch';
import { IOhMyResponse, isReadyResponse, originalDescriptor } from "./oh-my-response";
import { persistResponse } from "./persist-response";

const descriptor = originalDescriptor('headers');

export function patchHeaders() {
  Object.defineProperties(window.Response.prototype, {
    headers: {
      ...descriptor,
      get: function (this: IOhMyResponse) {
        if (!ohMyWindow().state?.active) {
          return this.__headers;
        }

        if (!this.ohResult) {
          const cached: IOhMyReadyResponse | undefined = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            method: this.ohMethod
          });
          this.ohResult = cached;

          if (cached && cached.response.status !== ohMyMockStatus.OK) {
            persistResponse(this, cached.request);
          }
        }

        const result = this.ohResult;

        if (isReadyResponse(result) && result.response.status === ohMyMockStatus.OK) {
          // A mock is allowed to have no headers; `jsonToHeaders` iterates what
          // it is given, so it needs an object rather than `undefined`.
          return fetchUtils.jsonToHeaders(result.response.headers ?? {});
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
  Reflect.deleteProperty(window.Response.prototype, '__headers');
}
