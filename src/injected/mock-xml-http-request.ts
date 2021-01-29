export function setup(mockFn: (url: string, method: string, data: string) => string = (a, b, c) => c): () => void {
  var _open = XMLHttpRequest.prototype.open;
  const _addEventListener = XMLHttpRequest.prototype.addEventListener;
  window.XMLHttpRequest.prototype.open = function (method, URL, ...args) {
    var _onreadystatechange = this.onreadystatechange,
      _this = this;

    if (URL.match(/highload/)) {
      URL = 'data:application/json; charset=utf-8,' + JSON.stringify({ apiVersion: "1.21.0", data: true });
    }

    _this.onreadystatechange = function () {
      if (_this.readyState === 4 && _this.status === 200) {
        try {
          //////////////////////////////////////
          // THIS IS ACTIONS FOR YOUR REQUEST //
          //             EXAMPLE:             //
          //////////////////////////////////////
          const mocked = mockFn(URL, method, _this.responseText);
          console.log('------------ mock ------------');

          if (URL.match(/^data/)) {
            debugger;
          }
          // rewrite responseText
          Object.defineProperty(_this, 'responseText', { value: mocked });
          Object.defineProperty(_this, 'response', { value: mocked });
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

    console.log('__open' + URL);
    return _open.call(_this, method, URL, ...args);
  };

  return () => { // remove mock
    XMLHttpRequest.prototype.open = _open;
  }
}
