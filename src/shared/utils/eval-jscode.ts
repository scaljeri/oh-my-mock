export const evalJsCode = (code: string): ((resp, mock) => unknown) => {
  code = `let output;${code};return output;`;
  const fnc = eval(new Function('data', 'response', code) as any);
  return fnc;
}
