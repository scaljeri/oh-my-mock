import { STORAGE_KEY } from '../shared/constants';
import { IMockedTmpResponse } from '../shared/type';
import { getHeaderKeys, getHeaderValues } from '../shared/utils/parse-xhr-headers';

export function mockAllResponseHeaders(origHeaders: string, response: IMockedTmpResponse | unknown): string {
  if (response[STORAGE_KEY]) {
    const data = this.state.data[response[STORAGE_KEY].mockIndex]
    return data.mocks[data.activeStatusCode].headers;
  } else {
    return origHeaders;
  }
}

export function mockResponseHeader(xhr: XMLHttpRequest, response: IMockedTmpResponse | unknown): (key: string) => string | null {
  let getResponseHeader = xhr.getResponseHeader.bind(xhr);

  if (response[STORAGE_KEY]) {
    const arh = xhr.getAllResponseHeaders();
    getResponseHeader = key => getHeaderValues(arh)[getHeaderKeys(arh).indexOf(key)];
  }

  return getResponseHeader;
}
