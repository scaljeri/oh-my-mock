import { ohMyMockStatus } from "../../shared/constants";
import { ohMyWindow } from "../../shared/oh-my-window";
import { IOhMyXhr, isXhrPatched, ohMyXhrPrototype, xhrDescriptor } from "../oh-my-xhr";
import { findCachedResponse } from "../utils";
import { persistResponse } from "./persist-response";

const isPatched = isXhrPatched('__responseText');
const descriptor = xhrDescriptor((isPatched ? '__' : '') + 'responseText');

export function patchResponseText() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'responseText', {
    ...descriptor,
    get: function (this: IOhMyXhr): string | undefined {
      if (!ohMyWindow().state?.active) {
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

      try {
        if (this.responseType !== '' && this.responseType !== 'text') {
          // Reading `responseText` with any other `responseType` is an
          // InvalidStateError. Let the original getter raise it (it is caught
          // below) rather than inventing a value for it.
          return this.__responseText;
        } else {
          return this.ohResult?.response?.response || this.__responseText;
        }
      } catch {
        // The InvalidStateError the comment above expects. A getter must return
        // something, and `undefined` is the closest thing to "no text here".
      }

      return undefined;
    }
  });
  Object.defineProperty(window.XMLHttpRequest.prototype, '__responseText', { ...descriptor });
}

export function unpatchResponseText() {
  const proto = ohMyXhrPrototype();

  Object.defineProperty(proto, 'responseText', descriptor);
  delete proto.__responseText;
}
