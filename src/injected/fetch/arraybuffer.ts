import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyReadyResponse } from "../../shared/packet-type";
import { b64ToArrayBuffer } from "../../shared/utils/binary";
import { findCachedResponse } from "../utils";
import { consumeBody, IOhMyResponse, isReadyResponse, originalDescriptor } from "./oh-my-response";
import { persistResponse } from "./persist-response";

const descriptor = originalDescriptor('arrayBuffer');

export function patchResponseArrayBuffer() {
  Object.defineProperties(window.Response.prototype, {
    arrayBuffer: {
      ...descriptor,
      // `async` so that a mock that is not valid base64 *rejects* the returned
      // promise, the way the native `arrayBuffer()` fails — `b64ToArrayBuffer`
      // goes through `atob`, which throws on anything else.
      value: async function (this: IOhMyResponse) {
        if (!ohMyWindow().state?.active) {
          return this.__arrayBuffer();
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
          // Marks the body as read (and rejects a second read) before the mock
          // is served — see `consumeBody`.
          await consumeBody(this);

          // A mock without a body is an empty body, not a reason to hand
          // `undefined` to `atob`.
          return b64ToArrayBuffer(result.response.response ?? '');
        } else {
          return this.__arrayBuffer();
        }
      }
    },
    __arrayBuffer: descriptor
  });
}

export function unpatchResponseArrayBuffer() {
  Object.defineProperty(window.Response.prototype, 'arrayBuffer', descriptor);
  Reflect.deleteProperty(window.Response.prototype, '__arrayBuffer');
}
