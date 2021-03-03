import { STORAGE_KEY } from '../shared/constants';
import { findActiveData } from '../shared/utils/find-mock';

export const mockStatusCodeFn = function (url: string, method: string, type: string, statusCode: number, response: unknown) {
  let data;

  if (response[STORAGE_KEY]) {
    data = this.state.data[response[STORAGE_KEY].mockIndex];
    this.log(`Duration for ${method} ${url} was ${Math.round((Date.now() - response[STORAGE_KEY].start) / 1000)} `);
  } else {
    data = findActiveData(this.state, url, method, type);
  }

  return data.activeStatusCode ? data.activeStatusCode : statusCode;
}
