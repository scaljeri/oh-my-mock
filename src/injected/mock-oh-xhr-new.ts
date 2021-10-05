let proto; //  = window.XMLHttpRequest.prototype;
let protoOpen; // = proto.open;
let protoSend; //  = proto.send;
let protoAddEventListener;//  = proto.addEventListener;

export function persistXmlHttpProto() {
  proto = window.XMLHttpRequest.prototype;
  protoOpen = proto.open;
  protoSend = proto.send;
  protoAddEventListener = proto.addEventListener;
}

export function unpatchXmlHttpRequest() {
  if (proto) {
    window.XMLHttpRequest.prototype = proto;
  }
}

export function patchXmlHttpRequest() {
  if (!proto) {
    persistXmlHttpProto();
  }

  window.XMLHttpRequest.prototype.open = function (...args) {
    this.ohListeners = [];
    this.ohMethod = args[0];
    this.ohUrl = args[1];

    return protoOpen.apply(this, args);
  }

  window.XMLHttpRequest.prototype.addEventListener = function (eventName, callback) {
    if (eventName === 'load') {
      this.ohListeners.push(callback);
    }

    return protoAddEventListener.call(this, eventName, callback);
  }

  window.XMLHttpRequest.prototype.send = function (body) {
    // 1) determine if mock is available
    console.log('URL===' + this.ohUrl);

    return protoSend.call(this, body);
  }
}