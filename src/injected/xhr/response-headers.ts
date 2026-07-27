import { findCachedResponse } from "../utils";
import * as headers from '../../shared/utils/xhr-headers';
import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyXhr, ohMyXhrPrototype, xhrDescriptor } from "../oh-my-xhr";
import { persistResponse } from "./persist-response";

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__getResponseHeader');
const descrAllHeaders = xhrDescriptor((isPatched ? '__' : '') + 'getAllResponseHeaders');
const descrHeader = xhrDescriptor((isPatched ? '__' : '') + 'getResponseHeader');

/**
 * Looks up (once per request) what the extension decided for this call, and
 * reports the real response back when it is not being mocked.
 */
function resolveResult(xhr: IOhMyXhr): void {
  if (xhr.ohResult) {
    return;
  }

  xhr.ohResult = findCachedResponse({
    url: xhr.ohUrl || xhr.responseURL.replace(window.origin, ''),
    method: xhr.ohMethod
  });

  if (xhr.ohResult && xhr.ohResult.response.status !== ohMyMockStatus.OK) {
    persistResponse(xhr, xhr.ohResult.request);
  }
}

export function patchResponseHeaders() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'getAllResponseHeaders', {
    ...descrAllHeaders,
    value: function (this: IOhMyXhr): string {
      if (!ohMyWindow().state?.active) {
        return this.__getAllResponseHeaders();
      }

      resolveResult(this);

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
    value: function (this: IOhMyXhr, header: string): string | null {
      if (!ohMyWindow().state?.active) {
        return this.__getResponseHeader(header);
      }

      resolveResult(this);

      if (this.ohResult?.response.status === ohMyMockStatus.OK) {
        return this.ohResult.response?.headers?.[header] ?? null;
      } else {
        return this.__getResponseHeader(header);
      }
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__getResponseHeader', { ...descrHeader });
}

export function unpatchResponseHeaders() {
  const proto = ohMyXhrPrototype();

  Object.defineProperty(proto, 'getAllResponseHeaders', descrAllHeaders);
  Object.defineProperty(proto, 'getResponseHeader', descrHeader);
  delete proto.__getAllResponseHeaders;
  delete proto.__getResponseHeader;
}
