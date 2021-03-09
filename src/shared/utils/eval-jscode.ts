export const evalJsCode = (code: string): ((mock) => unknown) => {
  code = `let output;${code};return output;`;
  const fnc = eval(new Function('mock', code) as any);
  return fnc;
}
