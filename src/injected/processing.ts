import { appSources, packetTypes, STORAGE_KEY } from '../shared/constants';
import { IData, IMock } from '../shared/type';
import { findActiveData } from '../shared/utils/find-mock';
import { evalJsCode } from '../shared/utils/eval-jscode';

export const processResponseFn = function (url: string, method: string, type: string, xhr: XMLHttpRequest, response: unknown) {
  let data: IData;
  let mock: IMock;

  if (response[STORAGE_KEY]) {
    data = this.state.data[response[STORAGE_KEY].mockIndex];
    this.log(`Duration for ${method} ${url} was ${ Math.round((Date.now() - response[STORAGE_KEY].start)/1000)} `);
  } else {
    window.postMessage({
      context: { url, method, type, statusCode: xhr.status },
      domain: window.location.host,
      source: appSources.INJECTED,
      type: packetTypes.MOCK,
      payload: { response, headers: xhr.getAllResponseHeaders() } }, '*');
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
    console.error('Could not execute jsCode', url, method, type, xhr.status, response, data);

    return mock?.response;
  }
}
