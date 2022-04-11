import { ohMyMockStatus, STORAGE_KEY } from "../../shared/constants";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__responseText');
const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'responseText');

export function patchResponseText() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'responseText', {
    ...descriptor,
    get: function () {
      if (!window[STORAGE_KEY].state.active) {
        return this.__responseText;
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

      if (this.responseType !== '' && this.responseType !== 'text') {
        return this.__status;
      } else {
        return this.ohResult.response?.response || this.__responseText;
      }
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__responseText', { ...descriptor });
}

export function unpatchResponseText() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'responseText', descriptor);
  delete window.XMLHttpRequest.prototype['__responseText'];
}
