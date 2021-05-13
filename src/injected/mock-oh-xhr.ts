import { STORAGE_KEY } from '../shared/constants';
import {
  IData,
  IMock,
  IOhMockResponse,
  requestMethod,
} from '../shared/type';
import { compileJsCode } from '../shared/utils/eval-jscode';
import { findMocks } from '../shared/utils/find-mock';
import * as headers from '../shared/utils/xhr-headers';

const Base = window.XMLHttpRequest;
export class OhMockXhr extends Base {
  private ohData: IData;
  private ohMock: IMock;
  private ohMethod: requestMethod;
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

    this.addEventListener('load', async (...args) => {
      this.parseState();

      if (this.ohMock) {
        this.ohOutput = await this.mockResponse();
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

  open(method: requestMethod, url: string, ...args: unknown[]): void {
    this.ohMethod = method; // e.g GET, POST
    this.ohUrl = url;

    this.parseState();
    return super.open.apply(this, [method, this.mockedUrl(url), ...args]);
  }

  ohMyReady(...args): void {
    if (this.ohOutput) {
      const headersString = headers.stringify(this.getHeaders());

      Object.defineProperty(this, 'status', {
        value: this.ohOutput.statusCode
      });
      Object.defineProperty(this, 'responseText', { value: this.ohOutput.response });
      Object.defineProperty(this, 'response', { value: this.ohOutput.response });
      Object.defineProperty(this, 'getAllResponseHeaders', {
        value: () => headersString
      });
      Object.defineProperty(this, 'getResponseHeader', {
        value: (key) => this.ohOutput.headers[key]
      });

      window[STORAGE_KEY].hitSubject.next({ id: this.ohData.id });
    } else {
      window[STORAGE_KEY].newMockSubject.next({
        context: {
          url: this.ohUrl,
          method: this.ohMethod,
          type: 'XHR'
        },
        data: {
          statusCode: this.status,
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

  private mockResponse(): Promise<IOhMockResponse> {
    if (!this.ohMock) {
      return this.response;
    }

    try {
      const code = compileJsCode(this.ohMock.jsCode);

      const context = {
        response: this.ohMock.responseMock,
        headers: this.ohMock.headersMock,
        delay: this.ohMock.delay,
        statusCode: this.ohData.mocks[this.ohData.activeMock].statusCode
      }

      return Promise.resolve(code(context, {
        url: this.ohUrl,
        method: this.ohMethod,
        body: this.ohRequestBody,
        headers: this.ohRequestHeaders
      }));
    } catch (err) {
      console.error('Could not execute jsCode', this.ohData, this.ohMock);
      return this.ohMock.responseMock || this.response;
    }
  }

  private parseState(): void {
    this.ohData = null;
    this.ohMock = null;

    this.ohData = findMocks(
      window[STORAGE_KEY].state, { url: this.ohUrl, type: 'XHR', method: this.ohMethod }, false);

    this.ohMock = this.ohData?.mocks?.[this.ohData?.activeMock]
  }

  private getHeaders(): Record<string, string>;
  private getHeaders(key: string): string;
  private getHeaders(key?: string): Record<string, string> | string | void {
    const output = this.ohOutput?.headers;

    return key ? (output || {})[key] : output;
  }
}
