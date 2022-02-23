import { findCachedResponse } from "../utils";

const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'status');

export function patchStatus() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'status', {
    ...descriptor,
    get: function () {
      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          method: this.ohMethod
        });
      }

      return this.ohResult?.response?.statusCode ?? this.__status;
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__status', { ...descriptor });
}

export function unpatchStatus() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'status', descriptor);
  delete window.XMLHttpRequest.prototype['__send'];
}
