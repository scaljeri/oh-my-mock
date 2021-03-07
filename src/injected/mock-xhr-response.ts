import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IData, IMock, IMockInject, IPacket, requestType, statusCode } from '../shared/type';
import { evalJsCode } from '../shared/utils/eval-jscode';
import * as headers from '../shared/utils/xhr-headers';

export class MockXhrResponse implements IMockInject {
  private mock: IMock;
  private response: unknown;
  private responseTxt: string;

  constructor(private xhr: XMLHttpRequest, private url, private type: requestType, private data: IData) {
    this.mock = data?.mocks[data.activeStatusCode];
  }

  setResponse(response: string): void {
    this.responseTxt = response;
    this.response = JSON.parse(response);
  }

  willMock(): boolean {
    return !!this.mock;
  }

  passThrough(): boolean {
    return this.mock.passThrough;
  }

  changeUrl(url: string): string {
    if (this.willMock()) {
      const resp = {
        [STORAGE_KEY]: {
          sourceUrl: this.url,
          mockUrl: this.data.url,
          start: Date.now()
        }
      }
      return 'data:application/json; charset=utf-8,' + encodeURIComponent(JSON.stringify(resp));
    } else {
      return url;
    }
  }

  mockUpdateMessage(): IPacket | null {
    if (!this.willMock() || this.passThrough()) {
      return {
        context: { url: this.url, method: 'XHR', type: this.type, statusCode: this.xhr.status },
        domain: window.location.host,
        source: appSources.INJECTED,
        type: packetTypes.MOCK,
        payload: { response: this.response, headers: headers.parse(this.xhr.getAllResponseHeaders()) }
      };
    }

    return null;
  }

  mockResponse(): string {
    if (!this.mock) {
      return this.responseTxt;
    }

    try {
      const code = evalJsCode(this.mock.jsCode);
      return JSON.stringify(code(this.mock, this.response[STORAGE_KEY] ? null : this.response));
    } catch (err) {
      console.error('Could not execute jsCode', this.url, 'XHR', this.type, this.xhr.status, this.response, this.data);
      return this.responseTxt;
    }
  }

  mockStatusCode(): statusCode {
    if (this.willMock()) {
      return this.data.activeStatusCode;
    }

    return this.xhr.status;
  }

  mockXhrProperties(): void {
    if (this.willMock) {
      Object.defineProperty(this.xhr, 'status', { value: this.data.activeStatusCode });
      Object.defineProperty(this.xhr, 'responseText', { value: this.responseTxt });
      Object.defineProperty(this.xhr, 'response', { value: this.responseTxt });
      Object.defineProperty(this.xhr, 'getAllResponseHeaders', { value: this.mockHeadersToString.bind(this) })
      Object.defineProperty(this.xhr, 'getResponseHeader', { value: this.mockResponseHeader.bind(this) })
    }
  }

  mockAllResponseHeaders(): Record<string, string> {
    if (this.willMock()) {
      return this.mock.headers || {};
    } else {
      return headers.parse(this.xhr.getAllResponseHeaders());
    }
  }

  mockResponseHeader(key: string): string {
    return (this.mock.headers || {})[key];
  }

  private mockHeadersToString(): string {
    return headers.stringify(this.mock.headers)
  }
}
