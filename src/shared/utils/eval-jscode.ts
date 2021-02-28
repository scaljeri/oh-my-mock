export const evalJsCode = (code: string): ((resp, mock) => unknown) => {
  code = `let output;${code};return output;`;
  const fnc = eval(new Function('response', 'data', code) as any);
  return fnc;
}
