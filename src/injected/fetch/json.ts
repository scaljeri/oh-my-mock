import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyReadyResponse } from "../../shared/packet-type";
import { findCachedResponse } from "../utils";
import { IOhMyResponse, isReadyResponse, originalDescriptor } from "./oh-my-response";
import { persistResponse } from "./persist-response";

const descriptor = originalDescriptor('json');

export function patchResponseJson() {
  Object.defineProperties(window.Response.prototype, {
    json: {
      ...descriptor,
      value: function (this: IOhMyResponse) {
        if (!ohMyWindow().state?.active) {
          return this.__json();
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
          const response = result.response.response;

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
  Reflect.deleteProperty(window.Response.prototype, '__json');
}
