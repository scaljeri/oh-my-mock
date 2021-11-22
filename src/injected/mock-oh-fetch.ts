import { IOhMyAPIRequest, requestMethod } from '../shared/type';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchApiResponse } from './message/dispatch-api-response';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { ohMyMockStatus, STORAGE_KEY } from '../shared/constants';
import { isBinary, toBlob, toDataURL } from '../shared/utils/binary';
import { logging } from '../shared/utils/log';

export const debug = logging(`${STORAGE_KEY} (^*^) DEBUG`);
export const log = logging(`${STORAGE_KEY} (^*^)`, true);

const ORIG_FETCH = window.fetch;

interface IOhFetchConfig {
  method?: requestMethod;
  __ohSkip?: boolean; // Use Fetch without caching or mocking
  headers?: Headers & { entries: () => [string, string][]}; // TODO: entries is not known in Headers
}

declare let window: { fetch: any };

const OhMyFetch = async (url, config: IOhFetchConfig = {}) => {
  if (config.__ohSkip) {
    return fecthApi(url, config);
  }
  const { response, headers, status, statusCode, delay } =
    await dispatchApiRequest({
      url,
      method: config.method || 'GET',
      ...config,
      ...(config.headers && { headers: fetchUtils.headersToJson(config.headers) })
    } as IOhMyAPIRequest, 'FETCH');

  if (status === ohMyMockStatus.ERROR) {
    log('Ooops, something went wrong while mocking your FETCH request!')
  }

  if (status !== ohMyMockStatus.OK) {
    return fecthApi(url, config);
  }

  return new Promise(async (resolv, reject) => {
    let body = null;


    if (response !== undefined) { // Otherwise error with statuscode 204 (No content)
      if (isBinary(headers['content-type'])) {
        body = await toBlob(response as string);
      } else {
        body = new Blob([response as any], { type: headers['content-type'] });
      }
    }

    const rsp = new Response(body, {
      headers: fetchUtils.jsonToHeaders(headers || {}),
      status: statusCode
    });

    setTimeout(() => resolv(rsp), delay || 0);
  });
}

function fecthApi(url, config): Promise<unknown> {
  const ohSkip = config.__ohSkip;
  delete config.__ohSkip;

  return ORIG_FETCH(url, config).then(async response => {
    if (!ohSkip) {
      const clone = response.clone();

      const headers = response.headers ? fetchUtils.headersToJson(response.headers) : {};
      await dispatchApiResponse({
        request: {
          url,
          method: config.method || 'GET',
          requestType: 'FETCH',
        },
        response: {
          statusCode: response.status,
          response: await (isBinary(headers['content-type']) ? toDataURL(await clone.blob()) : clone.text()),
          headers
        }
      });
    }

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
