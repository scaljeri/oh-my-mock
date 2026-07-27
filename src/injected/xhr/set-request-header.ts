import { IOhMyXhr, ohMyXhrPrototype, xhrDescriptor } from '../oh-my-xhr';

// const setRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__setRequestHeader');
const descriptor = xhrDescriptor((isPatched ? '__' : '') + 'setRequestHeader');

export function patchSetRequestHeader() {
  Object.defineProperties(window.XMLHttpRequest.prototype, {
    setRequestHeader: {
      ...descriptor,
      value: function (this: IOhMyXhr, key: string, value: string) {
        // `open` seeds this map, but headers can be set on an instance that
        // was never opened through the patch.
        (this.ohHeaders ??= {})[key] = value;

        return this.__setRequestHeader(key, value);
      }
    },
    __setRequestHeader: descriptor
  });

  // window.XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
  //   this.ohHeaders[key] = value;
  //   return setRequestHeader.call(this, key, value);
  // }
}

export function unpatchSetRequestHeader() {
  const proto = ohMyXhrPrototype();

  // window.XMLHttpRequest.prototype.setRequestHeader = setRequestHeader;
  Object.defineProperty(proto, 'setRequestHeader', descriptor);
  delete proto.__setRequestHeader;
}
