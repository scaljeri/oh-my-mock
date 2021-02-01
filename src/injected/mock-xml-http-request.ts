export function setup(
  mockFn: (url: string, method: string) => unknown | null,
  storeResponseFn: (url: string, method, data: unknown) => void): () => void {

  var _open = XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, URL, ...args) {
    var _onreadystatechange = this.onreadystatechange,
      _this = this;

    const mock = mockFn(URL, method);
    if (mock) {
      URL = 'data:application/json; charset=utf-8,' + mock;
    }

    _this.onreadystatechange = function () {
      if (_this.readyState === 4 && _this.status === 200) {
        try {
          if (!mock) {
            storeResponseFn(URL, method, _this.responseText);
          }
          // rewrite responseText
          // Object.defineProperty(_this, 'responseText', { value: JSON.stringify(mock) });
          // Object.defineProperty(_this, 'response', { value: JSON.stringify(mock) });
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
