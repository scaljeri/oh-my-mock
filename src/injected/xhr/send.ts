import { IS_BASE64_RE, ohMyMockStatus } from "../../shared/constants";
import { IOhMyResponseUpdate } from "../../shared/packet-type";
import { IOhMyAPIRequest } from "../../shared/type";
import { toBlob, toDataURL } from "../../shared/utils/binary";
import { parse } from "../../shared/utils/xhr-headers";
import { dispatchApiRequest } from "../message/dispatch-api-request";
import { dispatchApiResponse } from "../message/dispatch-api-response";

const send = window.XMLHttpRequest.prototype.send;

export function patchSend() {
  window.XMLHttpRequest.prototype.send = function (body) {
    dispatchApiRequest({
      url: this.ohUrl,
      method: this.ohMethod,
      headers: this.ohHeaders,
      body
    } as IOhMyAPIRequest, 'XHR').then(async data => {
      if (data.response.status !== ohMyMockStatus.OK) { // No cache
        this.addEventListener('load', event => { // TODO: Should we do something with  `event`??
          // TODO: use requestType to determine what to do
          toDataURL(this.response, (response) => {
            dispatchApiResponse({
              request: { url: this.ohUrl, method: this.ohMethod, requestType: 'XHR' },
              response: { statusCode: this.status, response: response, headers: parse(this.getAllResponseHeaders()) },
            } as IOhMyResponseUpdate);
          });
        });
        send.call(this, body);
      } else {
        // if ((data.response as string).match(IS_BASE64_RE)) { // It is base64 => Blob
          // data.response = await toBlob(data.response as string);
        // }

        // injectResponse(this, data);

        setTimeout(() => {
          this.onreadystatechange?.();
          this.onload?.();

          const progressEvent = new ProgressEvent('load', { /* ....???.... */ });
          this.ohListeners.forEach(l => l(progressEvent));
        }, data.response.delay);
      }
    });
  }
}

export function unpatchSend() {
  window.XMLHttpRequest.prototype.send = send;
}
