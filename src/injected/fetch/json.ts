import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyReadyResponse } from "../../shared/packet-type";
import { findCachedResponse } from "../utils";
import { consumeBody, IOhMyResponse, isReadyResponse, originalDescriptor } from "./oh-my-response";
import { persistResponse } from "./persist-response";

const descriptor = originalDescriptor('json');

export function patchResponseJson() {
  Object.defineProperties(window.Response.prototype, {
    json: {
      ...descriptor,
      // `async` so that a mock that is not valid JSON *rejects* the returned
      // promise, the way the native `json()` fails. As a plain function the
      // `JSON.parse` below threw synchronously — from a method whose callers,
      // per its contract, only attach `.catch`.
      value: async function (this: IOhMyResponse) {
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
          // Marks the body as read (and rejects a second read) before the mock
          // is served — see `consumeBody`.
          await consumeBody(this);

          const response = result.response.response;

          return typeof response === 'string' ? JSON.parse(response) : response;
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
