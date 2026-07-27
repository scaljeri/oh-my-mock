import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyReadyResponse } from "../../shared/packet-type";
import { findCachedResponse } from "../utils";
import { IOhMyResponse, isReadyResponse, originalDescriptor } from "./oh-my-response";
import { persistResponse } from "./persist-response";

const descriptor = originalDescriptor('text');

export function patchResponseText() {
  Object.defineProperties(window.Response.prototype, {
    text: {
      ...descriptor,
      value: async function (this: IOhMyResponse) {
        if (!ohMyWindow().state?.active) {
          return this.__text();
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
          let output: string | undefined = result.response.response;

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
    __text: descriptor
  });
}

export function unpatchResponseText() {
  Object.defineProperty(window.Response.prototype, 'text', descriptor);
  Reflect.deleteProperty(window.Response.prototype, '__text');
}
