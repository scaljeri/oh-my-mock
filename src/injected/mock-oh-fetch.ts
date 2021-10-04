import { IData, IMock, IOhMyRequest, requestMethod } from '../shared/type';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchApiResponse } from './message/dispatch-api-response';
import { dispatchApiRequest } from './message/dispatch-api-request';
import { ohMyMockStatus } from '../shared/constants';

const ORIG_FETCH = window.fetch;

const OhMyFetch = async (url, config: { method?: requestMethod } = {}) => {
  // TODO: wat komt er uit eval, een IMock?? dan moet dit anders
  const { data, response, headers, mock, status } =
    await dispatchApiRequest({
      url,
      method: 'GET',
      ...config
    } as IOhMyRequest, 'FETCH');

  if (status === ohMyEvalStatus.NOT_FOUND) {
    return fecthApi(url, config);
  }

  return new Promise(async (resolv, reject) => {
    let body = null;

    if (status === ohMyEvalStatus.ERROR) {
      return reject();
    }

    if (response !== undefined) { // Otherwise error with statuscode 204 (No content)
      body = new Blob([response as any], { type: headers['content-type'] });
    }

    const rsp = new Response(body, {
      headers: fetchUtils.jsonToHeaders(headers),
      status: mock.statusCode
    });

    setTimeout(() => resolv(rsp), mock.delay ?? mock.delay);
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

export { OhMyFetch };
