import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyReadyResponse } from "../../shared/packet-type";
import { b64ToBlob } from "../../shared/utils/binary";
import { getMimeType } from "../../shared/utils/mime-type";
import { findCachedResponse } from "../utils";
import { consumeBody, IOhMyResponse, isReadyResponse, originalDescriptor } from "./oh-my-response";
import { persistResponse } from "./persist-response";

const descriptor = originalDescriptor('blob');

export function patchResponseBlob() {
  Object.defineProperties(window.Response.prototype, {
    blob: {
      ...descriptor,
      value: async function (this: IOhMyResponse) {
        if (!ohMyWindow().state?.active) {
          return this.__blob();
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
          // A mock may carry no headers at all, in which case there is no
          // content type to give the Blob.
          const contentType = getMimeType(result.response.headers ?? {});

          return b64ToBlob(response, contentType); // TODO: Can this also be a normal string
        } else {
          return this.__blob();
        }
      }
    },
    __blob: descriptor
  });
}

export function unpatchResponseBlob() {
  Object.defineProperty(window.Response.prototype, 'blob', descriptor);
  Reflect.deleteProperty(window.Response.prototype, '__blob');
}
