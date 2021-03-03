import { STORAGE_KEY } from '../shared/constants';
import { IData, IMock } from '../shared/type';
import { findActiveData } from '../shared/utils/find-mock';
import { evalJsCode } from '../shared/utils/eval-jscode';

export const processResponseFn = function (url: string, method: string, type: string, statusCode: number, response: unknown) {
  let data: IData;
  let mock: IMock;

  if (response[STORAGE_KEY]) {
    data = this.state.data[response[STORAGE_KEY].mockIndex];
    this.log(`Duration for ${method} ${url} was ${ Math.round((Date.now() - response[STORAGE_KEY].start)/1000)} `);
  } else {
    window.postMessage({ url, method, type, statusCode, mock: { response } }, window.location.href);
    data = findActiveData(this.state, url, method, type);
  }

  if (!data) {
    return response;
  }

  try {
    mock = data.mocks[data.activeStatusCode];

    if (!mock) {
      return response;
    }

    const code = evalJsCode(mock.jsCode);
    return code(mock, response[STORAGE_KEY] ? null : response);
  } catch(err) {
    console.error('Could not execute jsCode', url, method, type, statusCode, response, data);

    return mock?.response;
  }
}
