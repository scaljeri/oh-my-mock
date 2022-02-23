const open = window.XMLHttpRequest.prototype.open;

export function patchOpen() {
  window.XMLHttpRequest.prototype.open = function (...args) {
    this.ohListeners = [];
    this.ohHeaders = {};
    this.ohMethod = args[0];
    this.ohUrl = args[1];

    return open.apply(this, args);
  }
}

export function unpatchOpen() {
  window.XMLHttpRequest.prototype.open = open;
}
