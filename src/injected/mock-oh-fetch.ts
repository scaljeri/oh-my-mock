import { IData, IMock, IOhMyEvalRequest, requestMethod } from '../shared/type';

import * as fetchUtils from '../shared/utils/fetch';
import { dispatchData } from './message/dispatch-eval';
import { ohMyState } from './state-manager';
import { mockHitMessage } from './message/mock-hit';
import { newMockMessage } from './message/new-response';
import { logMocked } from './utils';

const ORIG_FETCH = window.fetch;
const OhMyFetch = async (url, config: { method?: requestMethod } = {}) => {
  const { method = 'GET' } = config;
  const data: IData = null; /*findMocks(ohMyState(), {
    url, type: 'FETCH', method
  });*/
  const mock: IMock = null; // data?.enabled && data?.mocks[data?.activeMock];

  if (mock) {
    mockHitMessage({ id: data.id });

    let result: Partial<IMock> = {
      statusCode: mock.statusCode,
      response: mock.responseMock,
      headers: mock.headersMock
    };

    result = await dispatchData(data, {
      url,
      method,
      headers: {},
      ...config
    } as IOhMyEvalRequest).catch(_ => _);
    logMocked(data, result);

    return new Promise(async (resolv, reject) => {
      let body = null;

      if (result === null) {
        return reject();
      }

      if (result.response !== undefined) { // Otherwise error with statuscode 204 (No content)
        body = new Blob([result.response], { type: result.headers['content-type'] });
      }

      const response = new Response(body, {
        headers: fetchUtils.jsonToHeaders(result.headers),
        status: result.statusCode
      });

      setTimeout(() => resolv(response), result.delay ?? mock.delay);
    });
  } else {
    return ORIG_FETCH(url, config).then(response => {
      if (!data || !data.mocks[response.status]) {
        const clone = response.clone();

        clone.text().then(txt => {
          newMockMessage({
            context: {
              url,
              method,
              requestType: 'FETCH'
            },
            data: {
              statusCode: response.status,
              response: txt,
              headers: fetchUtils.headersToJson(response.headers)
            }
          });
        });
      }

      return response;
    });
  }
}

export { OhMyFetch };
