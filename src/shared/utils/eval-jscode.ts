export const evalJsCode = (code: string): ((mock) => unknown) => {
  code = `let output;${code};return output;`;
  // tslint-disable-next
  const fnc = eval(new Function('mock', code) as any);
  return fnc;
};
