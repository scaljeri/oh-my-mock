import { STORAGE_KEY } from '../shared/constants';
import {
  IData,
  IMock,
  IOhMockResponse,
  requestType,
} from '../shared/type';
import { compileJsCode } from '../shared/utils/eval-jscode';
import { findActiveData } from '../shared/utils/find-mock';
import * as headers from '../shared/utils/xhr-headers';

const Base = window.XMLHttpRequest;

export class OhMockXhr extends Base {
  private ohData: IData;
  private ohMock: IMock;
  private ohType: requestType;
  private ohUrl: string;
  private ohListeners = [];
  private ohRequestBody: unknown;
  private ohRequestHeaders: Record<string, string> = {};
  private ohOutput: IOhMockResponse;

  constructor() {
    super();

    Object.defineProperty(this, 'onreadystatechange', {
      get: function () {
        return undefined;
      },
      set: function (callback) {
        this.ohListeners.push(callback);
      }
    });

    this.addEventListener('load', (...args) => {
      this.parseState();

      if (this.ohMock) {
        this.ohOutput = this.mockResponse();
      }

      setTimeout(() => {
        this.ohMyReady(...args);
      }, this.ohOutput?.delay || 0);
    });

    const ael = this.addEventListener.bind(this);
    Object.defineProperty(this, 'addEventListener', {
      value: (type: string, cb: (_: Event) => void) => {
        if (type == 'load') {
          this.ohListeners.push(cb);
        } else {
          ael(type, cb);
        }
      }
    });
  }

  send(body) {
    this.ohRequestBody = body;
    super.send(body);
  }

  setRequestHeader(key, value) {
    this.ohRequestHeaders[key] = value;
    super.setRequestHeader(key, value);
  }

  open(type: requestType, url: string, ...args: unknown[]): void {
    this.ohType = type; // e.g GET, POST
    this.ohUrl = url;

    this.parseState();
    return super.open.apply(this, [type, this.mockedUrl(url), ...args]);
  }

  ohMyReady(...args): void {
    if (this.ohOutput) {
      const headersString = headers.stringify(this.getHeaders());

      Object.defineProperty(this, 'status', {
        value: this.ohOutput.statusCode
      });
      Object.defineProperty(this, 'responseText', { value: this.ohOutput.responseMock });
      Object.defineProperty(this, 'response', { value: this.ohOutput.responseMock });
      Object.defineProperty(this, 'getAllResponseHeaders', {
        value: () => headersString
      });
      Object.defineProperty(this, 'getResponseHeader', {
        value: (key) => this.ohOutput.headers[key]
      });

      window[STORAGE_KEY].hitSubject.next({
        url: this.ohUrl,
        method: 'XHR',
        type: this.ohType,
        statusCode: this.status
      });
    } else {
      window[STORAGE_KEY].newMockSubject.next({
        context: {
          url: this.ohUrl,
          method: 'XHR',
          type: this.ohType,
          statusCode: this.status
        },
        data: {
          response: this.response,
          headers: headers.parse(this.getAllResponseHeaders())
        }
      });
    }
    this.ohListeners.forEach(l => l.apply(this, args));
  }


  private mockedUrl(url: string): string {
    if (this.ohMock) {
      const mimeType = this.getHeaders('content-type') || 'text/plain';
      return `data:${mimeType},${STORAGE_KEY}-${this.ohUrl}`;
    }

    return url;
  }

  private mockResponse(): IOhMockResponse {
    if (!this.ohMock) {
      return this.response;
    }

    try {
      const code = compileJsCode(this.ohMock.jsCode);

      return code.call({ ...this.ohMock, statusCode: this.ohData.activeStatusCode }, {
        url: this.ohUrl,
        method: this.ohType,
        requestBody: this.ohRequestBody,
        requestHeaders: this.ohRequestHeaders });
    } catch (err) {
      console.error('Could not execute jsCode', this.ohData, this.ohMock);
      return this.ohMock.responseMock || this.response;
    }
  }

  private parseState(): void {
    this.ohData = null;
    this.ohMock = null;

    this.ohData = findActiveData(
      window[STORAGE_KEY].state,
      this.ohUrl,
      'XHR',
      this.ohType
    );

    this.ohMock = this.ohData?.mocks
      ? this.ohData.mocks[this.ohData.activeStatusCode]
      : null;
  }

  private getHeaders(): Record<string, string>;
  private getHeaders(key: string): string;
  private getHeaders(key?: string): Record<string, string> | string | void {
    const output = this.ohOutput?.headersMock;

    return key ? (output || {})[key] : output;
  }
}
