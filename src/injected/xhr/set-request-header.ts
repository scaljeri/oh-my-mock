// const setRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__setRequestHeader');
const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'setRequestHeader');

export function patchSetRequestHeader() {
  Object.defineProperties(window.XMLHttpRequest.prototype, {
    setRequestHeader: {
      ...descriptor,
      value: function (key, value) {
        this.ohHeaders[key] = value;
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
  // window.XMLHttpRequest.prototype.setRequestHeader = setRequestHeader;
  Object.defineProperty(window.XMLHttpRequest.prototype, 'setRequestHeader', descriptor);
  delete window.XMLHttpRequest.prototype['__setRequestHeader'];
}
