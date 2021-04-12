import { IOhMockResponse } from '../type';

export const compileJsCode = (code: string): ((request) => IOhMockResponse) => {
  code = `${code};\n\nreturn this;`;
  // tslint-disable-next
  return eval(new Function('request', code) as any);
};

