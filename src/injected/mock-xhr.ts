import { findActiveData } from '../shared/utils/find-mock';
import { MockXhrResponse } from './mock-xhr-response';
import * as headers from '../shared/utils/xhr-headers';

export const mockXhr = {
  memOpen: null,
  state: null,
  isMocking: function () { return !!this.memOpen },
  enable: function () {
    const self = this;
    self.disable();

    self.memOpen = XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (type, url, ...args) {
      let _onreadystatechange = this.onreadystatechange;
      const _this = this;
      const mock = new MockXhrResponse(
        this,
        url,
        type,
        findActiveData(self.state, url, 'XHR', type));

      url = mock.changeUrl(url);

      _this.onreadystatechange = function () {
        if (_this.readyState === 4) {
          // TODO: response type is alwas JSON
          mock.setResponse(_this.responseText);
          const msg = mock.mockUpdateMessage();
          // TODO: Post msg
          const newRespStr = mock.mockResponse();

          if (mock.willMock()) {
            Object.defineProperty(_this, 'status', { value: mock.mockStatusCode() });
            Object.defineProperty(_this, 'responseText', { value: newRespStr });
            Object.defineProperty(_this, 'response', { value: newRespStr });
            Object.defineProperty(_this, 'getAllResponseHeaders', { value: () => headers.stringify(mock.mockAllResponseHeaders()) })
            Object.defineProperty(_this, 'getResponseHeader', { value: mock.mockResponseHeader.bind(mock) })
          }
        }
        if (_onreadystatechange) _onreadystatechange.apply(this, arguments);
      }

      // detect any onreadystatechange changing
      Object.defineProperty(this, "onreadystatechange", {
        get: function () {
          return _onreadystatechange;
        },
        set: function (value) {
          _onreadystatechange = value;
        }
      });

      return self.memOpen.call(_this, type, url, ...args);
    }
  },
  disable: function () {
    if (this.memOpen) {
      window.XMLHttpRequest.prototype.open = this.memOpen;
    }
    this.memOpen = null;
  }
}
