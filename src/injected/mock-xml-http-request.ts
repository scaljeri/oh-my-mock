import { IMockedTmpResponse } from '../shared/type';
import { mockResponseHeader } from './mock-response-headers';

const STORAGE_KEY = 'OhMyMocks'; // TODO
const log = (msg, ...data) => console.log(`${STORAGE_KEY} (^*^) InJecTed(XML): ${msg}`, ...data);

export function setup(
  mockDataFn: (url: string, method: string, type: string) => unknown | null,
  processResponseFn: (url: string, method: string, type: string, xhr: XMLHttpRequest, data: unknown) => void,
  mockStatusCodeFn: (url: string, method: string, type: string, statusCode: number, data: unknown) => number,
  mockAllResponseHeadersFn: (headers: string, response: IMockedTmpResponse | unknown) => string): () => void {
  log('Patched XMLHttpRequest');

  var _open = XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (type, URL, ...args) {
    log('Received request', URL);
    const origUrl = URL;
    var _onreadystatechange = this.onreadystatechange,
      _this = this;

    const mock = mockDataFn(URL, 'XHR', type);
    if (mock) {
      URL = 'data:application/json; charset=utf-8,' + encodeURIComponent(JSON.stringify(mock));
    }

    _this.onreadystatechange = function () {
      if (_this.readyState === 4) {
        try {
          const respJson = JSON.parse(_this.responseText);
          const rspTxt = JSON.stringify(processResponseFn(origUrl, 'XHR', type, _this, respJson));
          const origHeaders = _this.getAllResponseHeaders();

          // rewrite responseText
          Object.defineProperty(_this, 'status', { value: mockStatusCodeFn(origUrl, 'XHR', type, _this.status, respJson) });
          Object.defineProperty(_this, 'responseText', { value: rspTxt });
          Object.defineProperty(_this, 'response', { value: rspTxt });
          Object.defineProperty(_this, 'getAllResponseHeaders', { value: () => mockAllResponseHeadersFn(origHeaders, respJson)})
          Object.defineProperty(_this, 'getResponseHeader', { value: mockResponseHeader(_this, respJson)})

          _this.getResponseHeader('date');
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

    return _open.call(_this, type, URL, ...args);
  };

  return () => { // remove mock
    XMLHttpRequest.prototype.open = _open;
  }
}
