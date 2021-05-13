import { IData, IMock, IState, ohMyMockId, requestMethod, requestType, statusCode } from '../type';
import { compareUrls } from './urls';

export const findMocks = (
  state: IState,
  { url, method, type, id }: {
    url?: string,
    method?: requestMethod,
    type?: requestType,
    id?: string,
    statusCode?: statusCode // added to simply interfaces
  },
  inactive = true // accept inactive IData
): IData => {
  for (let i = 0; i < state?.data?.length; i++) {
    const item = state.data[i];

    if (id ? id === item.id :
      method === item.method && type === item.type && (url === item.url || compareUrls(url, item.url))) {
      if (inactive || item.activeMock) {
        return item;
      }
    }
  }
};

export const findMockByStatusCode = (statusCode: statusCode, mocks: Record<ohMyMockId, IMock> = {}): IMock | void => {
  const key = Object.keys(mocks).find(k => mocks[k].statusCode === statusCode);

  return key ? mocks[key] : null;
}
