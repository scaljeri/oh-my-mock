import { IS_BASE64_RE, ohMyMockStatus } from '../shared/constants';
import { IOhMyAPIRequest, IOhMyMockResponse } from '../shared/type';
import { parse } from '../shared/utils/xhr-headers';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { dispatchApiResponse } from './message/dispatch-api-response';
import * as headers from '../shared/utils/xhr-headers';
import { toBlob, toDataURL } from '../shared/utils/binary';
import { findCachedResponse } from './utils';

// To serve OhMyMock responses for XMLHttpRequest, the following properties will be replaced:
let protoOpen;
let protoSend;
let protoAddEventListener;
let protoSetRequestHeader;
let protoResponse;
let protoResponseText;
let protoStatus;

function persistXmlHttpProto() {
  const proto = window.XMLHttpRequest.prototype;
  protoOpen = proto.open;
  protoSend = proto.send;
  protoAddEventListener = proto.addEventListener;
  protoSetRequestHeader = proto.setRequestHeader;
  protoResponse = Object.getOwnPropertyDescriptor(proto, 'response');
  // protoResponseText = proto.responseText;
  protoResponseText = Object.getOwnPropertyDescriptor(proto, 'responseText');
  protoStatus = Object.getOwnPropertyDescriptor(proto, 'status');
}

export function unpatchXmlHttpRequest() {
  if (protoOpen) {
    window.XMLHttpRequest.prototype.open = protoOpen;
    window.XMLHttpRequest.prototype.send = protoSend;
    window.XMLHttpRequest.prototype.addEventListener = protoAddEventListener;
    window.XMLHttpRequest.prototype.setRequestHeader = protoSetRequestHeader;
    Object.defineProperties(window.XMLHttpRequest.prototype, {
      response: protoResponse,
      responseText: protoResponseText,
      status: protoStatus
    });
  }
}

export function patchXmlHttpRequest() {
  if (!protoOpen) {
    persistXmlHttpProto();
  }

  window.XMLHttpRequest.prototype.open = function (...args) {
    this.ohListeners = [];
    this.ohHeaders = {};
    this.ohMethod = args[0];
    this.ohUrl = args[1];

    return protoOpen.apply(this, args);
  }

  window.XMLHttpRequest.prototype.addEventListener = function (eventName, callback) {
    if (eventName === 'load') {
      this.ohListeners.push(callback);
    }

    return protoAddEventListener.call(this, eventName, callback);
  }

  window.XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
    this.ohHeaders[key] = value;
    return protoSetRequestHeader.call(this, key, value);
  }

  window.XMLHttpRequest.prototype.send = function (body) {
    dispatchApiRequest({
      url: this.ohUrl,
      method: this.ohMethod,
      headers: this.ohHeaders,
      body
    } as IOhMyAPIRequest, 'XHR').then(async data => {
      if (data.status !== ohMyMockStatus.OK) {
        this.addEventListener('load', event => {
          // TODO: Should we do something with this event
          toDataURL(this.response, (response) => {
            dispatchApiResponse({
              request: { url: this.ohUrl, method: this.ohMethod, requestType: 'XHR' },
              response: { statusCode: this.status, response: response, headers: parse(this.getAllResponseHeaders()) },
            });
          });
        });
        protoSend.call(this, body);
      } else {
        if ((data.response as string).match(IS_BASE64_RE)) { // It is base64 => Blob
          data.response = await toBlob(data.response as string);
        }

        injectResponse(this, data);

        setTimeout(() => {
          this.onreadystatechange?.();
          this.onload?.();

          const progressEvent = new ProgressEvent('load', { /* ....???.... */ });
          this.ohListeners.forEach(l => l(progressEvent));
        }, data.delay);
      }
    });
  }

  const descriptor = Object.getOwnPropertyDescriptor(window.XMLHttpRequest.prototype, 'response');
  console.log('PATCHING-------')
  Object.defineProperties(window.XMLHttpRequest.prototype, {
    response: {
      ...descriptor,
      get: function () {
        // TODO: Lookup cached response
        console.log('------RETURN  RESPONSE:', this.ohMyResponse);
        const result = findCachedResponse(this.responseURL.replace(window.origin, ''), 'XHR')
        debugger;
        // const result = findCachedResponse()
        return result?.response?.response || this.ohMyResponse;
      },
      set: function (resp: unknown) {
        console.log('-------SET RESPONSE:', resp);
        this.ohMyResponse = resp;
      }
    },
    status: {
      get: function () {
      },
      set: function (status: number) {
        this.ohMyStatus = status;
      }
    }
  });
}

function injectResponse(xhr: XMLHttpRequest, data: IOhMyMockResponse) {
  const headersAsString = headers.stringify(data.headers);

  Object.defineProperties(xhr, {
    status: { value: data.statusCode },
    readyState: { value: XMLHttpRequest.DONE },
    responseText: { value: data.response },
    response: { value: data.response },
    getAllResponseHeaders: { value: () => headersAsString },
    getResponseHeader: { value: (key) => data.headers[key] }
  });
}
