import { IMock, IOhMyEvalRequest } from '../type';

export const compileJsCode = (code: string): ((mock: Partial<IMock>, request: IOhMyEvalRequest) => Partial<IMock>) => {
  code = `'use strict';${code}`;
  // tslint-disable-next
  return eval(new Function('mock', 'request', code) as any);
};

