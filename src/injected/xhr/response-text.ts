import { OhMyResponseStatus, STORAGE_KEY } from "../../shared/constants";
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
          requestMethod: this.ohMethod
        });

        if (this.ohResult && this.ohResult.response.status !== OhMyResponseStatus.OK) {
          persistResponse(this, this.ohResult.request);
        }
      }

      try {
        if (this.responseType !== '' && this.responseType !== 'text') {
          return this.__status;
        } else {
          return this.ohResult?.response?.response || this.__responseText;
        }
      } catch(err) {
      }
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__responseText', { ...descriptor });
}

export function unpatchResponseText() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Object.defineProperty(window.XMLHttpRequest.prototype, 'responseText', descriptor!);
  delete window.XMLHttpRequest.prototype['__responseText'];
}
