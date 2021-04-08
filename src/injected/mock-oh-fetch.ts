import { STORAGE_KEY } from '../shared/constants';
import { IData, IMock, requestType } from '../shared/type';
import { evalJsCode } from '../shared/utils/eval-jscode';
import { findActiveData } from '../shared/utils/find-mock'
import * as fetchUtils from '../shared/utils/fetch';

const ORIG_FETCH = window.fetch;
const OhMyFetch = (url, config: { method?: requestType } = {}) => {
  const { method = 'GET' } = config;
  const data: IData = findActiveData(window[STORAGE_KEY].state, url, 'FETCH', method);
  const mock: IMock = data?.mocks[data?.activeStatusCode];
  debugger;

  if (mock) {
    window[STORAGE_KEY].hitSubject.next({
      url: url,
      method: 'FETCH',
      type: method,
      statusCode: data.activeStatusCode
    });

    return new Promise((resolv, reject) => {
      try {
        const responseData = evalJsCode(mock.jsCode)(mock) as string;
        const body = new Blob([responseData], { type: mock.headersMock['content-type'] });

        const response = new Response(body, {
          headers: fetchUtils.jsonToHeaders(mock.headersMock),
          status: data.activeStatusCode
        });

        setTimeout(() => resolv(response), mock.delay);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return ORIG_FETCH(url, config).then(response => {
      if (!data || !data.mocks[response.status]) {
        const clone = response.clone();

        clone.text().then(txt => {
          window[STORAGE_KEY].newMockSubject.next({
            context: {
              url,
              method: 'FETCH',
              type: method,
              statusCode: response.status
            },
            data: {
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
