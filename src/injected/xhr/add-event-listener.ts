// const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__addEventListener');
// const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'addEventListener');

// const addEventListener = window.XMLHttpRequest.prototype.addEventListener;

export function patchAddEventListener() {
  const addEventListener = window.XMLHttpRequest.prototype['__addEventListener'] ||
    window.XMLHttpRequest.prototype.addEventListener;

  window.XMLHttpRequest.prototype.addEventListener = function (eventName: string, callback) {
    if (eventName === 'load') {
      this.ohListeners.push(callback);
    }

    return this.__addEventListener(eventName, callback);
  }
  window.XMLHttpRequest.prototype['__addEventListener'] = addEventListener;

  // window.XMLHttpRequest.prototype.addEventListener = function (eventName, callback) {
  //   if (eventName === 'load') {
  //     this.ohListeners.push(callback);
  //   }

  //   return addEventListener.call(this, eventName, callback);
  // }
}

export function unpatchAddEventListener() {
  if (window.XMLHttpRequest.prototype['__addEventListener']) {
    window.XMLHttpRequest.prototype.addEventListener = window.XMLHttpRequest.prototype['__addEventListener'];
    delete window.XMLHttpRequest.prototype['__addEventListener'];
  }
  // Object.defineProperty(window.XMLHttpRequest.prototype, 'addEventListener', descriptor);
}
