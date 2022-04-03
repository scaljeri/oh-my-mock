// const open = window.XMLHttpRequest.prototype.open;

const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__open');
const descriptor = { ...Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, isPatched ? '__open' : 'open') };

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
}

export function unpatchOpen() {
  if (window.XMLHttpRequest.prototype['__open']) {
    Object.defineProperty(window.XMLHttpRequest.prototype, 'open', descriptor);
    delete window.XMLHttpRequest.prototype['__open'];
  }
}
