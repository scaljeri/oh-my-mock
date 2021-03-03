import { STORAGE_KEY } from '../shared/constants';
import { findActiveData } from '../shared/utils/find-mock';

export const mockingFn = function (url: string, method: string, type: string) {
  const data = findActiveData(this.state, url, method, type);
  const mock = data?.mocks[data.activeStatusCode];

  if (!mock || mock.passThrough) {
    return;
  }

  return { [STORAGE_KEY]: { start: Date.now(), mockIndex: this.state.data.indexOf(data) }};
}
