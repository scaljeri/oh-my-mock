import { ohMyMockStatus, STORAGE_KEY } from '../shared/constants';
import { IData, IOhMyAPIRequest } from '../shared/type';
import { StateUtils } from '../shared/utils/state';
import { parse } from '../shared/utils/xhr-headers';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { dispatchApiResponse } from './message/dispatch-api-response';

let proto; //  = window.XMLHttpRequest.prototype;
let protoOpen; // = proto.open;
let protoSend; //  = proto.send;
let protoAddEventListener;//  = proto.addEventListener;

function persistXmlHttpProto() {
    proto = window.XMLHttpRequest.prototype;
    protoOpen = proto.open;
    protoSend = proto.send;
    protoAddEventListener = proto.addEventListener;
}

export function unpatchXmlHttpRequest() {
    if (proto) {
        window.XMLHttpRequest.prototype.open = protoOpen;
        window.XMLHttpRequest.prototype.send = protoSend;
        window.XMLHttpRequest.prototype.addEventListener = protoAddEventListener;
    }
}

export function patchXmlHttpRequest() {
    if (!proto) {
        persistXmlHttpProto();
    }

    window.XMLHttpRequest.prototype.open = function (...args) {
        this.ohListeners = [];
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

    window.XMLHttpRequest.prototype.send = function (body) {
        // const { response, headers, status } =
        // TODO: add headers!!
        dispatchApiRequest({
            url: this.ohUrl,
            method: 'GET',
            body
        } as IOhMyAPIRequest, 'XHR').then(data => {
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