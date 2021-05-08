import { IData, IState, requestMethod, requestType, statusCode } from '../type';
import { compareUrls } from './urls';

export const findActiveData = (
  state: IState,
  { url, method, type, id }: {
    url?: string,
    method?: requestMethod,
    type?: requestType,
    id?: string,
    statusCode?: statusCode // added to simply interfaces
  },
  inactive = true
): IData => {
  for (let i = 0; i < state?.data?.length; i++) {
    const item = state.data[i];

    if (id ? id === item.id :
      method === item.method && type === item.type && (url === item.url || compareUrls(url, item.url))) {
      if (inactive || item.activeStatusCode > 0) {
        return item;
      }
    }
  }
};
