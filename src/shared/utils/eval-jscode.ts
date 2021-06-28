import { IMock, IOhMyEvalRequest } from '../type';

export const compileJsCode = (code: string): ((mock: Partial<IMock>, request: IOhMyEvalRequest) => Partial<IMock>) => {
  // tslint-disable-next
  return eval(`async (mock, request) => {'use strict';${code}}`);
};

