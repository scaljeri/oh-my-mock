import { IData, IState, requestMethod, requestType } from '../type';
import { compareUrls } from './urls';

export const findActiveData = (
  state: IState,
  url: string,
  method: requestMethod,
  type: requestType
): IData => {
  const data = (state?.data || []).find((item) => {
    return (
      method === item.method && type === item.type && compareUrls(url, item.url)
    );
  });

  if (!data) {
    return null;
  }

  return data;
};
