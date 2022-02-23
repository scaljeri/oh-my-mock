import { findCachedResponse } from "../utils";
import * as headers from '../../shared/utils/xhr-headers';

const descrAllHeaders = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'getAllResponseHeaders');
const descrHeader = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'getResponseHeaders');

export function patchResponseHeaders() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getAllResponseHeaders', {
    ...descrAllHeaders,
    value: function () {
      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          method: this.ohMethod
        });
      }

      const headersObj = this.ohResult.response.headers;
      if (headersObj) {
        return headers.stringify(headersObj);
      } else {
        this.__getAllResponseHeaders();
      }
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__getAllResponseHeaders', { ...descrAllHeaders });

  Object.defineProperty(window.XMLHttpRequest.prototype, 'getResponseHeader', {
    ...descrHeader,
    value: function (header: string) {
      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          method: this.ohMethod
        });
      }

      return this.ohResult.response?.headers?.[header] || this.__getResponseHeader(header);
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__getResponseHeader', { ...descrAllHeaders });
}

export function unpatchResponseHeaders() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getAllResponseHeaders', descrAllHeaders);
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getResponseHeader', descrHeader);
  delete window.XMLHttpRequest.prototype['__getAllResponseHeaders'];
  delete window.XMLHttpRequest.prototype['__getResponseHeader'];
}
