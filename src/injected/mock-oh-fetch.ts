import { IOhMyAPIRequest, requestMethod } from '../shared/type';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchApiResponse } from './message/dispatch-api-response';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { ohMyMockStatus } from '../shared/constants';

const ORIG_FETCH = window.fetch;

declare let window: { fetch: any };

const OhMyFetch = async (url, config: { method?: requestMethod } = {}) => {
  const { response, headers, status, statusCode, delay } =
    await dispatchApiRequest({
      url,
      method: config.method || 'GET',
      ...config
    } as IOhMyAPIRequest, 'FETCH');

  if (status === ohMyMockStatus.NO_CONTENT) {
    return fecthApi(url, config);
  }

  return new Promise(async (resolv, reject) => {
    let body = null;

    if (status === ohMyMockStatus.ERROR) {
      return reject();
    }

    if (response !== undefined) { // Otherwise error with statuscode 204 (No content)
      body = new Blob([response as any], { type: headers['content-type'] });
    }

    const rsp = new Response(body, {
      headers: fetchUtils.jsonToHeaders(headers),
      status: statusCode
    });

    setTimeout(() => resolv(rsp), delay  || 0);
  });
}

function fecthApi(url, config): Promise<unknown> {
  return ORIG_FETCH(url, config).then(async response => {
    const clone = response.clone();

    await dispatchApiResponse({
      data: {
        url,
        method: config.method || 'GET',
        requestType: 'FETCH',
      },
      mock: {
        statusCode: response.status,
        response: await clone.text(),
        headers: fetchUtils.headersToJson(response.headers)
      }
    });

    return response;
  });
}

function patchFetch(): void {
  window.fetch = OhMyFetch;
}

function unpatchFetch(): void {
  window.fetch = ORIG_FETCH;
}

export { OhMyFetch, unpatchFetch, patchFetch };
