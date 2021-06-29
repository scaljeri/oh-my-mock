import { MOCK_JS_CODE, ohMyEvalStatus, STORAGE_KEY } from '../shared/constants';
import {
  IData,
  IMock,
  requestMethod,
} from '../shared/type';
import { findMocks } from '../shared/utils/find-mock';
import { logging } from '../shared/utils/log';
import * as headers from '../shared/utils/xhr-headers';
import { dispatchEval } from './message/dispatch-eval';
import { mockHitMessage } from './message/mock-hit';
import { newMockMessage } from './message/new-response';
import { ohMyState } from './state-manager';

const Base = window.XMLHttpRequest;
const debug = logging(`${STORAGE_KEY} (^*^) | XhrMock`);
const log = logging(`${STORAGE_KEY} (^*^) | XhrMock`, true);

export class OhMockXhr extends Base {
  private ohData: IData;
  private ohMock: IMock;
  private ohMethod: requestMethod;
  private ohUrl: string;
  private ohListeners = [];
  private ohRequestBody: unknown;
  private ohRequestHeaders: Record<string, string> = {};
  private ohOutput: Partial<IMock>;
  private ohMyOnload;

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
        log(`${this.ohMethod} ${this.ohUrl}`, this.ohOutput);
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

  async send(body) {
    this.ohRequestBody = body;

    this.ohMyOnload = this.onload;
    this.onload = null;

    if (this.ohMock) {
      this.dispatchEvent(new Event('load'));
    } else {
      super.send(body);
    }
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

      mockHitMessage({ id: this.ohData.id });
    } else {
      newMockMessage({
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
    this.ohListeners.forEach(l => l?.apply(this, args));
    if (this.ohMyOnload) {
      this.ohMyOnload();
    }
  }


  private mockedUrl(url: string): string {
    if (this.ohMock) {
      const mimeType = this.getHeaders('content-type') || 'text/plain';
      return `data:${mimeType},${STORAGE_KEY}-${this.ohUrl}`;
    }

    return url;
  }

  private async mockResponse(): Promise<Partial<IMock>> {
    if (!this.ohMock) {
      return this.response;
    }

    if (this.ohMock.jsCode === MOCK_JS_CODE) {
      return Promise.resolve({
        ...this.ohMock,
        response: this.ohMock.responseMock,
        headers: this.ohMock.headersMock
      });
    } else {
      return await dispatchEval(this.ohData, {
        url: this.ohUrl,
        method: this.ohMethod,
        body: this.ohRequestBody,
        headers: this.ohRequestHeaders
      });
    }
  }

  private parseState(): void {
    const state = ohMyState();

    this.ohData = null;
    this.ohMock = null;

    this.ohData = findMocks(state, { url: this.ohUrl, type: 'XHR', method: this.ohMethod }, false);
    this.ohMock = this.ohData?.enabled && this.ohData?.mocks?.[this.ohData?.activeMock]
  }

  private getHeaders(): Record<string, string>;
  private getHeaders(key: string): string;
  private getHeaders(key?: string): Record<string, string> | string | void {
    const output = this.ohOutput?.headers;

    return key ? (output || {})[key] : output;
  }
}
