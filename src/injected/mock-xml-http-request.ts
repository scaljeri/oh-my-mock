const STORAGE_KEY = 'OhMyMocks'; // TODO
const log = (msg, ...data) => console.log(`${STORAGE_KEY} (^*^) InJecTed(XML): ${msg}`, ...data);

export function setup(
  mockDataFn: (url: string, method: string) => unknown | null,
  processResponseFn: (url: string, method: string, data: unknown) => void,
  mockStatusCodeFn: (url: string, method: string, statusCode: number) => number): () => void {
  log('Patched XMLHttpRequest');

  var _open = XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, URL, ...args) {
    log('Received request', URL);
    const origUrl = URL;
    var _onreadystatechange = this.onreadystatechange,
      _this = this;

    const mock = mockDataFn(URL, method);
    if (mock) {
      URL = 'data:application/json; charset=utf-8,' + encodeURIComponent(JSON.stringify(mock));
    }

    _this.onreadystatechange = function () {
      if (_this.readyState === 4 && _this.status === 200) {
        try {
          log('Received data', origUrl, _this.responseText, mock);

          const rspTxt = JSON.stringify(processResponseFn(origUrl, method, JSON.parse(_this.responseText)));

          // rewrite responseText
          Object.defineProperty(_this, 'status', { value: mockStatusCodeFn(origUrl, method, _this.status) });
          Object.defineProperty(_this, 'responseText', { value: rspTxt });
          Object.defineProperty(_this, 'response', { value: rspTxt });
          /////////////// END //////////////////
        } catch (e) { }
      }
      // call original callback
      if (_onreadystatechange) _onreadystatechange.apply(this, arguments);
    };

    // detect any onreadystatechange changing
    Object.defineProperty(this, "onreadystatechange", {
      get: function () {
        return _onreadystatechange;
      },
      set: function (value) {
        _onreadystatechange = value;
      }
    });

    return _open.call(_this, method, URL, ...args);
  };

  return () => { // remove mock
    XMLHttpRequest.prototype.open = _open;
  }
}
