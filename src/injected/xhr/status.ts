import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyXhr, ohMyXhrPrototype, xhrDescriptor } from "../oh-my-xhr";
import { findCachedResponse } from "../utils";

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__status');
const descriptor = xhrDescriptor((isPatched ? '__' : '') + 'status');

export function patchStatus() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'status', {
    ...descriptor,
    get: function (this: IOhMyXhr): number {
      if (!ohMyWindow().state?.active) {
        return this.__status;
      }

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
  const proto = ohMyXhrPrototype();

  Object.defineProperty(proto, 'status', descriptor);
  delete proto.__status;
}
