import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { b64ToArrayBuffer, b64ToBlob } from "../../shared/utils/binary";
import { IOhMyXhr, ohMyXhrPrototype, xhrDescriptor } from "../oh-my-xhr";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__response');
const descriptor = xhrDescriptor((isPatched ? '__' : '') + 'response');

export function patchResponse() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'response', {
    ...descriptor,
    get: function (this: IOhMyXhr): unknown {
      if (!ohMyWindow().state?.active) {
        return this.__response;
      }

      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          method: this.ohMethod
        });

        if (this.ohResult && this.ohResult.response.status !== ohMyMockStatus.OK) {
          persistResponse(this, this.ohResult.request);
        }
      }

      if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
        // Mocks are stored as text, so every `responseType` other than text
        // needs the stored string decoded back into the shape the caller
        // expects.
        const mocked = this.ohResult.response.response;

        if (this.responseType === 'blob') {
          return b64ToBlob(mocked);
        } else if (this.responseType === 'arraybuffer') {
          return b64ToArrayBuffer(mocked ?? '');
        } else if (this.responseType === 'json' && typeof mocked === 'string') {
          return JSON.parse(mocked);
        }

        return mocked;
      }

      return this.__response;
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__response', { ...descriptor });
}

export function unpatchResponse() {
  const proto = ohMyXhrPrototype();

  Object.defineProperty(proto, 'response', descriptor);
  delete proto.__response;
}
