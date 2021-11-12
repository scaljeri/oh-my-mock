import { IMock } from '../type';

export const compileJsCode = (code: string): ((mock: Partial<IMock>, request: any) => Partial<IMock>) => {
  // tslint-disable-next
  return eval(`async (mock, request) => {'use strict';${code}}`);
};

