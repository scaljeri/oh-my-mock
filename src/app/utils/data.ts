import { IData, statusCode } from '../../shared/type';

export const findAutoActiveMock = (data: IData): statusCode | void => {
  if (~~[undefined, 0].indexOf(data.activeStatusCode) && Object.keys(data.mocks).length > 0) {
    return Number(Object.keys(data.mocks).sort()[0]);
  }
}
