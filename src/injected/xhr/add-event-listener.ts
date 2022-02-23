const addEventListener = window.XMLHttpRequest.prototype.addEventListener;

export function patchAddEventListener() {
  window.XMLHttpRequest.prototype.addEventListener = function (eventName, callback) {
    if (eventName === 'load') {
      this.ohListeners.push(callback);
    }

    return addEventListener.call(this, eventName, callback);
  }
}

export function unpatchAddEventListener() {
  window.XMLHttpRequest.prototype.addEventListener = addEventListener;
}
