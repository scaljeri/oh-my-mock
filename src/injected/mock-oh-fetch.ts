import { IOhMyAPIRequest, requestMethod } from '../shared/type';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchApiResponse } from './message/dispatch-api-response';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { ohMyMockStatus, STORAGE_KEY } from '../shared/constants';
import { isBinary, blobToDataURL } from '../shared/utils/binary';
import { logging } from '../shared/utils/log';
import { patchResponseBlob, unpatchResponseBlob } from './fetch/blob';
import { patchHeaders, unpatchHeaders } from './fetch/headers';
import { patchResponseArrayBuffer, unpatchResponseArrayBuffer } from './fetch/arraybuffer';
import { patchResponseJson, unpatchResponseJson } from './fetch/json';
import { patchResponseText, unpatchResponseText } from './fetch/text';
import { patchStatus, unpatchStatus } from './fetch/status';

export const debug = logging(`${STORAGE_KEY} (^*^) DEBUG`);
export const log = logging(`${STORAGE_KEY} (^*^)`, true);

interface IOhFetchConfig {
  method?: requestMethod;
  headers?: Headers & { entries: () => [string, string][] }; // TODO: entries is not known in Headers
  body?: FormData | unknown;
}

declare let window: { fetch: any };

const OhMyFetch = async (request: string | Request, config: IOhFetchConfig = {}) => {
  let url = request as string;
  if (request instanceof Request) {
    config = { headers: request.headers as any, method: request.method as requestMethod };
    url = request.url;
  }

  if (config.body instanceof FormData) {
    const fd = {};
    config.body.forEach((value, key) => fd[key] = value);
    config.body = fd;
  }


  const result = await dispatchApiRequest({
    url,
    method: config.method || 'GET',
    ...(config.body && { body: config.body }),
    ...(config.headers && { headers: fetchUtils.headersToJson(config.headers) })
  } as IOhMyAPIRequest, 'FETCH');

  const { response, headers, status, statusCode, delay } = result.response;

  if (status === ohMyMockStatus.ERROR) {
    log('Ooops, something went wrong while mocking your FETCH request!')
  }

  if (status !== ohMyMockStatus.OK) {
    return OhMyFetch['__fetch'].call(window, request, config).then(async response => {
      const clone = response.clone();

      const headers = fetchUtils.headersToJson(clone['__headers']);
      response.ohResult = {
        request: {
          url,
          method: config.method || 'GET',
          requestType: 'FETCH',
        },
        response: {
          statusCode: clone['__status'],
          response: await (isBinary(headers['content-type']) ? blobToDataURL(await clone['__blob']()) : clone['__text']()),
          headers
        }
      };

      await dispatchApiResponse(response.ohResult);

      return response;
    });
  }

  return new Promise(resolve => {
    const resp = new Response();
    resp['ohUrl'] = url;
    resp['ohMethod'] = config.method;

    setTimeout(() => resolve(resp), delay || 0);
  });

  // return new Promise(async (resolv, reject) => {
  //   let body = null


  //   if (response !== undefined && statusCode !== 204) { // Otherwise error with statuscode 204 (No content)
  //     if (isBinary(headers['content-type'])) {
  //       body = await b64ToBlob(response as string);
  //     } else {
  //       body = new Blob([response as any], { type: headers['content-type'] });
  //     }
  //   }

  //   const rsp = new Response(body, {
  //     headers: fetchUtils.jsonToHeaders(headers || {}),
  //     status: statusCode
  //   });
  //   setTimeout(() => resolv(rsp), delay || 0);
  // });
}

// function fecthApi(url, config): Promise<unknown> {
//   return window[STORAGE_KEY].fetch.call(window, url, config).then(async response => {
//     const clone = response.clone();

//     const headers = response.headers ? fetchUtils.headersToJson(response.headers) : {};
//     await dispatchApiResponse({
//       request: {
//         url,
//         method: config.method || 'GET',
//         requestType: 'FETCH',
//       },
//       response: {
//         statusCode: response.status,
//         response: await (isBinary(headers['content-type']) ? blobToDataURL(await clone.blob()) : clone.text()),
//         headers
//       }
//     });

//     return response;
//   });
// }

function patchFetch(): void {
  const origFetch = window.fetch['__fetch'] || window.fetch;
  window.fetch = OhMyFetch;
  console.log('PATCH EVERYTHONG');
  OhMyFetch['__fetch'] = origFetch;
  patchResponseBlob();
  patchResponseArrayBuffer();
  patchResponseJson();
  patchResponseText();
  patchHeaders();
  patchStatus();
}

function unpatchFetch(): void {
  if (window.fetch['__fetch']) {
    window.fetch = window.fetch['__fetch'];
  }

  unpatchResponseBlob();
  unpatchResponseArrayBuffer();
  unpatchResponseJson();
  unpatchResponseText();
  unpatchHeaders();
  unpatchStatus();
}

export { unpatchFetch, patchFetch };
