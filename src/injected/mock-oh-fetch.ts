import { MOCK_JS_CODE, STORAGE_KEY } from '../shared/constants';
import { IData, IMock, IOhMyEvalRequest, requestMethod } from '../shared/type';
import { findMocks } from '../shared/utils/find-mock'
import * as fetchUtils from '../shared/utils/fetch';
import { dispatchEval } from './message/dispatch-eval';
import { ohMyState } from './state-manager';
import { mockHitMessage } from './message/mock-hit';
import { newMockMessage } from './message/new-response';
import { logging } from '../shared/utils/log';

const debug = logging(`${STORAGE_KEY} (^*^) | XhrMock`);
const log = logging(`${STORAGE_KEY} (^*^) | FetchMock`, true)

const ORIG_FETCH = window.fetch;
const OhMyFetch = async (url, config: { method?: requestMethod } = {}) => {
  const { method = 'GET' } = config;
  const data: IData = findMocks(ohMyState(), {
    url, type: 'FETCH', method
  });
  const mock: IMock = data?.enabled && data?.mocks[data?.activeMock];

  if (mock) {
    mockHitMessage({ id: data.id });

    let result: Partial<IMock> = {
      ...mock,
      response: mock.responseMock,
      headers: mock.headersMock
    };

    if (mock.jsCode !== MOCK_JS_CODE) {
      result = await dispatchEval(data, {
        url,
        method,
        headers: {},
        ...config
      } as IOhMyEvalRequest);
    }
    log(`${method} ${url}`, result);

    return new Promise(async (resolv, reject) => {
      let body = null;

      if (result.response !== undefined) { // Otherwise error with statuscode 204 (No content)
        body = new Blob([result.response], { type: result.headers['content-type'] });
      }

      const response = new Response(body, {
        headers: fetchUtils.jsonToHeaders(result.headers),
        status: result.statusCode
      });

      setTimeout(() => resolv(response), result.delay);
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
              type: 'FETCH'
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
