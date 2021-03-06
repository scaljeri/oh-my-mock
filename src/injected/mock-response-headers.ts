import { STORAGE_KEY } from '../shared/constants';
import { IMockedTmpResponse } from '../shared/type';
import * as xhrHeaders from '../shared/utils/xhr-headers';

export function mockAllResponseHeaders(origHeaders: string, response: IMockedTmpResponse | unknown): string {
  if (response[STORAGE_KEY]) {
    const data = this.state.data[response[STORAGE_KEY].mockIndex];
    return xhrHeaders.stringify(data.mocks[data.activeStatusCode].headers);
  } else {
    return origHeaders;
  }
}

export function mockResponseHeader(xhr: XMLHttpRequest, response: IMockedTmpResponse | unknown): (key: string) => string | null {
  let mock = xhr.getResponseHeader;

  if (response[STORAGE_KEY]) {
    const data = this.state.data[response[STORAGE_KEY].mockIndex];
    const headers = data.mocks[data.activeStatusCode].headers;

    mock = key => headers[key];
  }

  return mock;
}
