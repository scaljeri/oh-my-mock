import { findCachedResponse } from "../utils";
import * as headers from '../../shared/utils/xhr-headers';
import { ohMyMockStatus } from "../../shared/constants";

const descrAllHeaders = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'getAllResponseHeaders');
const descrHeader = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'getResponseHeader');

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
        return this.__getAllResponseHeaders();
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

      if (this.ohResult && this.ohResult.response.status === ohMyMockStatus.OK) {
        return this.ohResult.response?.headers?.[header];
      } else {
        return this.__getResponseHeader(header);
      }
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__getResponseHeader', { ...descrHeader });
}

export function unpatchResponseHeaders() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getAllResponseHeaders', descrAllHeaders);
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getResponseHeader', descrHeader);
  delete window.XMLHttpRequest.prototype['__getAllResponseHeaders'];
  delete window.XMLHttpRequest.prototype['__getResponseHeader'];
}
