import { IOhMyXhr, ohMyXhrPrototype } from '../oh-my-xhr';

// const isPatched = !!window.XMLHttpRequest.prototype.hasOwnProperty('__addEventListener');
// const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, (isPatched ? '__' : '') + 'addEventListener');

// const addEventListener = window.XMLHttpRequest.prototype.addEventListener;

export function patchAddEventListener() {
  const proto = ohMyXhrPrototype();
  const addEventListener = proto.__addEventListener ?? proto.addEventListener;

  proto.addEventListener = function (this: IOhMyXhr, eventName: string, callback: EventListenerOrEventListenerObject) {
    if (eventName === 'load') {
      // `open` seeds this list, but a listener can be registered on an
      // instance that was never opened through the patch.
      (this.ohListeners ??= []).push(callback);
    }

    return this.__addEventListener(eventName, callback);
  }
  proto.__addEventListener = addEventListener;
}

export function unpatchAddEventListener() {
  const proto = ohMyXhrPrototype();

  if (proto.__addEventListener) {
    proto.addEventListener = proto.__addEventListener;
    delete proto.__addEventListener;
  }
  // Object.defineProperty(window.XMLHttpRequest.prototype, 'addEventListener', descriptor);
}
