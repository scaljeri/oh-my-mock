import { STORAGE_KEY } from '../constants';
import { IOhMockResponse } from '../type';

export const compileJsCode = (code: string): ((mock, request) => IOhMockResponse) => {
  code = `const fetch = window['${STORAGE_KEY}'].fetch;` +
        `const XMLHttpRequest = window['${STORAGE_KEY}'].XMLHttpRequest;${code};\nreturn mock;`;
  // tslint-disable-next
  return eval(new Function('mock', 'request', code) as any);
};

