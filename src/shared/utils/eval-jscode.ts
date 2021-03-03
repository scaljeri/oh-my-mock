export const evalJsCode = (code: string): ((resp, mock) => unknown) => {
  code = `let output;${code};return output;`;
  const fnc = eval(new Function('mock', 'response', code) as any);
  return fnc;
}
