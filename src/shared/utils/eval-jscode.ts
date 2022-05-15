import { IOhMyAPIRequest, IOhMyMockResponse } from '../type';

export const compileJsCode = (code: string): ((mock: Partial<IOhMyMockResponse>, request: IOhMyAPIRequest) => Partial<IOhMyMockResponse>) => {
  // tslint-disable-next
  return eval(`async (mock, request, response) => {'use strict';${code}}`);
};

