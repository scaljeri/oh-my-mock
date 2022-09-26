import { findCachedResponse } from "../utils";
import * as headers from '../../shared/utils/xhr-headers';
import { IOhMyResponseStatus, STORAGE_KEY } from "../../shared/constants";
import { persistResponse } from "./persist-response";

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__getResponseHeader');
const descrAllHeaders = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'getAllResponseHeaders');
const descrHeader = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'getResponseHeader');

export function patchResponseHeaders() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getAllResponseHeaders', {
    ...descrAllHeaders,
    value: function () {
      if (!window[STORAGE_KEY]?.state.active) {
        return this.__getAllResponseHeaders();
      }

      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          requestMethod: this.ohMethod
        });

        if (this.ohResult && this.ohResult.response.status !== IOhMyResponseStatus.OK) {
          persistResponse(this, this.ohResult.request);
        }
      }

      const headersObj = this.ohResult?.response.headers;
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
      if (!window[STORAGE_KEY]?.state.active) {
        return this.__getResponseHeader();
      }

      if (!this.ohResult) {
        this.ohResult = findCachedResponse({
          url: this.ohUrl || this.responseURL.replace(window.origin, ''),
          requestMethod: this.ohMethod
        });

        if (this.ohResult && this.ohResult.response.status !== IOhMyResponseStatus.OK) {
          persistResponse(this, this.ohResult.request);
        }
      }

      if (this.ohResult?.response.status === IOhMyResponseStatus.OK) {
        return this.ohResult.response?.headers?.[header];
      } else {
        return this.__getResponseHeader(header);
      }
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__getResponseHeader', { ...descrHeader });
}

export function unpatchResponseHeaders() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getAllResponseHeaders', descrAllHeaders!);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getResponseHeader', descrHeader!);
  delete window.XMLHttpRequest.prototype['__getAllResponseHeaders'];
  delete window.XMLHttpRequest.prototype['__getResponseHeader'];
}
