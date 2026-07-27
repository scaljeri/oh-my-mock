// TODO
import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyReadyResponse } from "../../shared/packet-type";
import { findCachedResponse } from "../utils";
import { IOhMyResponse, isReadyResponse, originalDescriptor } from "./oh-my-response";
import { persistResponse } from "./persist-response";

const descriptor = originalDescriptor('status');

export function patchStatus() {
  Object.defineProperties(window.Response.prototype, {
    status: {
      ...descriptor,
      get: function (this: IOhMyResponse) {
        if (!ohMyWindow().state?.active) {
          return this.__status;
        }

        if (!this.ohResult) {
          const cached: IOhMyReadyResponse | undefined = findCachedResponse({
            url: this.ohUrl || this.url.replace(window.origin, ''),
            method: this.ohMethod || 'GET'
          });
          this.ohResult = cached;

          if (cached && cached.response.status === ohMyMockStatus.OK) {
            return cached.response.statusCode;
          } else {
            persistResponse(this, cached?.request);
            return this.__status;
          }
        }

        const result = this.ohResult;

        if (isReadyResponse(result) && result.response.status === ohMyMockStatus.OK) {
          return result.response.statusCode;
        } else {
          return this.__status;
        }
      }
    },
    __status: descriptor
  });
}

export function unpatchStatus() {
  Object.defineProperty(window.Response.prototype, 'status', descriptor);
  Reflect.deleteProperty(window.Response.prototype, '__status');
}
