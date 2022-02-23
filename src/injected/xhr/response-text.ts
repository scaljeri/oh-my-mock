import { findCachedResponse } from "../utils";

const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'responseText');

export function patchResponseText() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'responseText', {
    ...descriptor,
    get: function () {
      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          method: this.ohMethod
        });
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
