import { ohMyMockStatus } from '../shared/constants';
import { IData, IOhMyAPIRequest } from '../shared/type';
import { parse } from '../shared/utils/xhr-headers';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { dispatchApiResponse } from './message/dispatch-api-response';

// TO serve OhMyMock responses for XMLHttpRequest, the following properties will be replaced:
let protoOpen;
let protoSend;
let protoAddEventListener;
let protoSetRequestHeader;

function persistXmlHttpProto() {
    const proto = window.XMLHttpRequest.prototype;
    protoOpen = proto.open;
    protoSend = proto.send;
    protoAddEventListener = proto.addEventListener;
    protoSetRequestHeader = proto.setRequestHeader;
}

export function unpatchXmlHttpRequest() {
    if (protoOpen) {
        window.XMLHttpRequest.prototype.open = protoOpen;
        window.XMLHttpRequest.prototype.send = protoSend;
        window.XMLHttpRequest.prototype.addEventListener = protoAddEventListener;
        window.XMLHttpRequest.prototype.setRequestHeader = protoSetRequestHeader;
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
        // const { response, headers, status } =
        debugger;
        dispatchApiRequest({
            url: this.ohUrl,
            method: 'GET',
            headers: this.ohHeaders,
            body
        } as IOhMyAPIRequest, 'XHR').then(data => {
          debugger;
            if (data.status === ohMyMockStatus.NO_CONTENT) {
                this.addEventListener('load', response => {
                    dispatchApiResponse({
                        data: { url: this.ohUrl, method: this.ohMethod, requestType: 'XHR' },
                        mock: { statusCode: this.status, response: this.responseText, headers: parse(this.getAllResponseHeaders()) },
                    });
                    console.log(this.ohUrl, this.readyState, response);
                })
                protoSend.call(this, body);
            } else {
                // TODO
            }
        });
    }
}

function mockResponse(xhr: XMLHttpRequest, data: IData) {
    setTimeout(() => {

    });
}
