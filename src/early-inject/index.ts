if (!XMLHttpRequest.prototype['__send']) {
  const dsend = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'send');
  const dopen = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'open');

  Object.defineProperties(window.XMLHttpRequest.prototype, {
    send: {
      ...dsend,
      value: function (body) {
        const sid = setInterval(() => {
          if (window['OhMyMocks']) {
            clearInterval(sid);
            XMLHttpRequest.prototype.send.call(this, body);
          }
        }, 50)
      }
    },
    open: {
      ...dopen,
      value: function (...args) {
        this.ohListeners = [];
        this.ohHeaders = {};
        this.ohMethod = args[0];
        this.ohUrl = args[1];

        this.__open(...args);
      }
    },
    __send: dsend,
    __open: dopen
  });

  window.XMLHttpRequest.prototype['__addEventListener'] = window.XMLHttpRequest.prototype.addEventListener;
  window.XMLHttpRequest.prototype.addEventListener = function (eventName: string, callback) {
    if (eventName === 'load') {
      this.ohListeners.push(callback);
    }

    return this.__addEventListener(eventName, callback);
  }

  const origFetch = window.fetch;
  (window as any).fetch = function (input, init) {
    return new Promise(function (r) {
      const fid = setInterval(function () {
        if (window['OhMyMocks']) {
          clearInterval(fid);
          r(window.fetch(input, init));
        }
      }, 50);
    })
  }
  window.fetch['__fetch'] = origFetch;
}
