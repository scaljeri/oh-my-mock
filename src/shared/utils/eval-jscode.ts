import { IOhMockResponse } from '../type';

export const compileJsCode = (code: string): ((mock, request) => IOhMockResponse) => {
  code = `${code};\n\nreturn mock;`;
  // tslint-disable-next
  return eval(new Function('mock', 'request', code) as any);
};

