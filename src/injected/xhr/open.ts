// const open = window.XMLHttpRequest.prototype.open;

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__open');
const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'open');

export function patchOpen() {
  Object.defineProperties(window.XMLHttpRequest.prototype, {
    open: {
      ...descriptor,
      value: function (...args) {
        this.ohListeners = [];
        this.ohHeaders = {};
        this.ohMethod = args[0];
        this.ohUrl = args[1];

        return this.__open(...args);
      }
    }, __open: { ...descriptor }
  });

  // window.XMLHttpRequest.prototype.open = function (...args) {
  //   this.ohListeners = [];
  //   this.ohHeaders = {};
  //   this.ohMethod = args[0];
  //   this.ohUrl = args[1];

  //   return open.apply(this, args);
  // }
}

export function unpatchOpen() {
  Object.defineProperty(window.XMLHttpRequest.prototype, 'open', descriptor);
  delete window.XMLHttpRequest.prototype['__open'];
}
