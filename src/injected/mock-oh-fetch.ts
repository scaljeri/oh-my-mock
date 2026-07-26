import { IOhMyAPIRequest, requestMethod } from '../shared/type';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { ohMyMockStatus, STORAGE_KEY } from '../shared/constants';
import { patchResponseBlob, unpatchResponseBlob } from './fetch/blob';
import { patchHeaders, unpatchHeaders } from './fetch/headers';
import { patchResponseArrayBuffer, unpatchResponseArrayBuffer } from './fetch/arraybuffer';
import { patchResponseJson, unpatchResponseJson } from './fetch/json';
import { patchResponseText, unpatchResponseText } from './fetch/text';
import { patchStatus, unpatchStatus } from './fetch/status';
import { persistResponse } from './fetch/persist-response';
import { error } from './utils';

interface IOhFetchConfig {
  method?: requestMethod;
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
    config = { headers: request.headers as any, method: request.method as requestMethod };
    url = request.url;
  }

  if (config.body instanceof FormData) {
    const fd = {};
    config.body.forEach((value, key) => fd[key] = value);
    config.body = fd;
  }

  config.method = (config.method || 'get').toUpperCase() as requestMethod;

  const result = await dispatchApiRequest({
    url,
    method: config.method,
    ...(config.body && { body: config.body }),
    ...(config.headers && { headers: fetchUtils.headersToJson(config.headers) })
  } as IOhMyAPIRequest, 'FETCH');

  const { response, headers, status, statusCode, delay } = result.response;

  if (status === ohMyMockStatus.ERROR) {
    error('Ooops, something went wrong while mocking your FETCH request!')
  }

  if (status !== ohMyMockStatus.OK) {
    return window[STORAGE_KEY]['__fetch'].call(window, request, config).then(async response => {
      response.ohResult = await persistResponse(response, result.request);

      return response;
    });
  }

  return new Promise(resolve => {
    // Build the Response with the mocked status rather than defaulting to 200
    // and overriding the `status` getter afterwards. `ok` and `statusText` are
    // native getters reading the same internal slot, and they cannot be patched
    // into agreement — a bare `new Response()` would keep reporting `ok: true`
    // for a mocked 500, so `if (!res.ok) throw` would never fire.
    const resp = new Response(null, { status: toValidResponseStatus(statusCode) });
    resp['ohUrl'] = url;
    resp['ohMethod'] = config.method;

    setTimeout(() => resolve(resp), delay || 0);
  });
}

// The Response constructor throws a RangeError outside 200-599, so a mock with
// a missing or nonsensical status code falls back to 200 instead of breaking
// the request it was meant to serve.
function toValidResponseStatus(statusCode: unknown): number {
  const code = Number(statusCode);

  return Number.isInteger(code) && code >= 200 && code <= 599 ? code : 200;
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
