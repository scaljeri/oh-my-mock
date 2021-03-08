import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IData, IMock, IState, requestType } from '../shared/type';
import { evalJsCode } from '../shared/utils/eval-jscode';
import { findActiveData } from '../shared/utils/find-mock';
import * as headers from '../shared/utils/xhr-headers';

const Base = window.XMLHttpRequest;

export class OhMockXhr extends Base {
  static ohState: IState;
  private ohData: IData;
  private ohMock: IMock;
  private ohType: requestType;
  private ohUrl: string;

  constructor() {
    super();

    this.onreadystatechange = this._onreadystatechange.bind(this, null);
    Object.defineProperty(this, "onreadystatechange", {
      get: function () {
        return this.onReadyStateChange;
      },
      set: function (callback) {
        this.onReadyStateChange = this._onreadystatechange.bind(this, callback);
      }
    });
  }

  open(type, url, ...args) {
    this.ohType = type;
    this.ohUrl = url;

    this.parseState();
    super.open.apply(this, [type, this.mockedUrl(url), ...args]);
  }

  _onreadystatechange(onReadyChangeCallback, ...args): void {
    if (this.readyState === 4) {
      this.parseState();

      if (this.ohMock) {
        const response = this.mockResponse(this.response);
        const headersString = headers.stringify(this.ohMock.headers);

        Object.defineProperty(this, 'status', { value: this.ohData.activeStatusCode });
        Object.defineProperty(this, 'responseText', { value: response });
        Object.defineProperty(this, 'response', { value: response });
        Object.defineProperty(this, 'getAllResponseHeaders', { value: () => headersString })
        Object.defineProperty(this, 'getResponseHeader', { value: (key) => this.ohMock.headers[key] })
      } else if (OhMockXhr.ohState?.enabled) {
        window.postMessage({
          context: { url: this.ohUrl, method: 'XHR', type: this.ohType, statusCode: this.status },
          domain: window.location.host,
          source: appSources.INJECTED,
          type: packetTypes.MOCK,
          payload: { response: JSON.parse(this.response), headers: headers.parse(this.getAllResponseHeaders()) }
        }, '*');

      }
    }

    if (onReadyChangeCallback) onReadyChangeCallback.apply(this, args);
  }

  private mockedUrl(url: string): string {
    if (this.ohMock) {
      const resp = {
        [STORAGE_KEY]: {
          sourceUrl: url,
          mockUrl: this.ohData.url,
          start: Date.now()
        }
      }
      return 'data:application/json; charset=utf-8,' + encodeURIComponent(JSON.stringify(resp));
    }

    return url;
  }

  private mockResponse(response: string): string {
    if (!this.ohMock) {
      return response;
    }

    try {
      const responseJson = JSON.parse(response);
      const code = evalJsCode(this.ohMock.jsCode);
      return JSON.stringify(code(this.ohMock, responseJson[STORAGE_KEY] ? null : responseJson));
    } catch (err) {
      console.error('Could not execute jsCode', this.ohData, this.ohMock);
      return this.response;
    }
  }

  private parseState(): void {
    this.ohData = null;
    this.ohMock = null;

    if (OhMockXhr.ohState.enabled) { // State can arrive late at the party
      this.ohData = findActiveData(OhMockXhr.ohState, this.ohUrl, 'XHR', this.ohType);
      this.ohMock = this.ohData?.mocks ? this.ohData.mocks[this.ohData.activeStatusCode] : null;
    }
  }
}
