import { IOhMyAPIRequest, IOhMyRequestMethod } from '../shared/types';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { OhMyResponseStatus, STORAGE_KEY } from '../shared/constants';
import { patchResponseBlob, unpatchResponseBlob } from './fetch/blob';
import { patchHeaders, unpatchHeaders } from './fetch/headers';
import { patchResponseArrayBuffer, unpatchResponseArrayBuffer } from './fetch/arraybuffer';
import { patchResponseJson, unpatchResponseJson } from './fetch/json';
import { patchResponseText, unpatchResponseText } from './fetch/text';
import { patchStatus, unpatchStatus } from './fetch/status';
import { persistResponse } from './fetch/persist-response';
import { error } from './utils';

interface IOhFetchConfig {
  method?: IOhMyRequestMethod;
  headers?: Headers & { entries: () => [string, string][] }; // TODO: entries is not known in Headers
  body?: FormData | unknown;
}

declare let window: { fetch: any };

async function ohMyFetch(request: string | Request, config: IOhFetchConfig = {}) {
  if (!window[STORAGE_KEY].state?.active) {
    return window[STORAGE_KEY]['__fetch'].call(window, request, config);
  }

  let url = request as string;
  if (request instanceof Request) {
    config = { headers: request.headers as any, method: request.method as IOhMyRequestMethod };
    url = request.url;
  }

  if (config.body instanceof FormData) {
    const fd = {};
    config.body.forEach((value, key) => fd[key] = value);
    config.body = fd;
  }

  config.method = (config.method || 'get').toUpperCase() as IOhMyRequestMethod;

  const result = await dispatchApiRequest({
    url,
    requestMethod: config.method,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ...(config.body && { body: config.body })!,
    ...(config.headers && { headers: fetchUtils.headersToJson(config.headers) })
  } as IOhMyAPIRequest);

  const { response, headers, status, statusCode, delay } = result.response;

  if (status === OhMyResponseStatus.ERROR) {
    error('Ooops, something went wrong while mocking your FETCH request!')
  }

  if (status !== OhMyResponseStatus.OK) {
    return window[STORAGE_KEY]['__fetch'].call(window, request, config).then(async response => {
      response.ohResult = await persistResponse(response, result.request);

      return response;
    });
  }

  return new Promise(resolve => {
    const resp = new Response();
    resp['ohUrl'] = url;
    resp['ohMethod'] = config.method;

    setTimeout(() => resolve(resp), delay || 0);
  });
}

function patchFetch(): void {
  window[STORAGE_KEY].fetch = ohMyFetch;
  patchResponseBlob();
  patchResponseArrayBuffer();
  patchResponseJson();
  patchResponseText();
  patchHeaders();
  patchStatus();
}

function unpatchFetch(): void {
  if (XMLHttpRequest.prototype['__fetch']) {
    unpatchResponseBlob();
    unpatchResponseArrayBuffer();
    unpatchResponseJson();
    unpatchResponseText();
    unpatchHeaders();
    unpatchStatus();
  }
}

export { unpatchFetch, patchFetch };
