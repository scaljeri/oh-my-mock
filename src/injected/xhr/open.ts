import { IOhMyXhr, ohMyXhrPrototype, xhrDescriptor } from '../oh-my-xhr';
import { toRequestMethod } from '../utils';

// const open = window.XMLHttpRequest.prototype.open;

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__open');
const descriptor = xhrDescriptor(isPatched ? '__open' : 'open');

export function patchOpen() {
  Object.defineProperties(window.XMLHttpRequest.prototype, {
    open: {
      ...descriptor,
      value: function (this: IOhMyXhr, method: string, url: string | URL, async = true, username?: string | null, password?: string | null) {
        this.ohListeners = [];
        this.ohHeaders = {};
        this.ohMethod = toRequestMethod(method);
        this.ohUrl = url.toString();

        return this.__open(method, url, async, username, password);
      }
    }, __open: { ...descriptor }
  });
}

export function unpatchOpen() {
  const proto = ohMyXhrPrototype();

  if (proto.__open) {
    Object.defineProperty(proto, 'open', descriptor);
    delete proto.__open;
  }
}
