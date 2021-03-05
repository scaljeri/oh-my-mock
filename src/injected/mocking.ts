import { STORAGE_KEY } from '../shared/constants';
import { IMockedTmpResponse } from '../shared/type';
import { findActiveData } from '../shared/utils/find-mock';

export const mockingFn = function (url: string, method: string, type: string): IMockedTmpResponse | null {
  const data = findActiveData(this.state, url, method, type);
  const mock = data?.mocks[data.activeStatusCode];

  if (!mock || mock.passThrough) {
    return null;
  }

  return { [STORAGE_KEY]: {
      sourceUrl: url,
      matchedUrl: data.url,
      start: Date.now(),
      mockIndex: this.state.data.indexOf(data) }};
}
