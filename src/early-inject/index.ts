const KEY = 'OhMyMock';

// Extract state from attribute

if (!window[KEY]) {
  window[KEY] = {};

  const dsend = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'send');
  const dopen = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'open');
  const dseth = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'setRequestHeader');

  Object.defineProperties(window.XMLHttpRequest.prototype, {
    send: {
      ...dsend,
      value: function (body) {
        if (!window[KEY].isEnabled) {
          return this.__send(body);
        }

        // Wait for the injected code
        const sid = setInterval(() => {
          if (window[KEY].xhr) {
            clearInterval(sid);
            window[KEY].xhr.send.call(this, body);
          }
        }, 50)
      }
    },
    open: {
      ...dopen,
      value: function (...args) {
        if (window[KEY].isEnabled) {
          this.ohListeners = [];
          this.ohHeaders = {};
          this.ohMethod = args[0];
          this.ohUrl = args[1];
        }

        this.__open(...args);
      }
    },
    setRequestHeader: {
      ...dseth,
      value: function (key, value) {
        if (window[KEY].isEnabled) {
          this.ohHeaders[key] = value;
        }

        return this.__setRequestHeader(key, value);
      }
    },
    __send: dsend,
    __open: dopen,
    __setRequestHeader: dseth
  });

  window.XMLHttpRequest.prototype['__addEventListener'] = window.XMLHttpRequest.prototype.addEventListener;
  window.XMLHttpRequest.prototype.addEventListener = function (eventName: string, callback) {
    if (window[KEY].isEnabled && eventName === 'load') {
      this.ohListeners ??= []; // just to be sure
      this.ohListeners.push(callback);
    }

    return this.__addEventListener(eventName, callback);
  }

  const origFetch = window.fetch;
  (window as any).fetch = function (input, init) {

    return new Promise(function (r) {
      const fid = setInterval(function () {
        if (window[KEY].fetch) {
          clearInterval(fid);
          r(window[KEY].isEnabled ? window[KEY].fetch(input, init) : window[KEY].__fetch.call(window, input, init));
        }
      }, 50);
    })
  }
  window[KEY]['__fetch'] = origFetch;
}

window.postMessage({
  source: 'pre-injected',
  payload: {
    type: 'ready',
    data: true
  }
}, '*');
