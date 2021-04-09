export const compileJsCode = (code: string): ((mock) => unknown) => {
  code = `let output;${code};\n\nreturn output;`;
  // tslint-disable-next
  const fnc = eval(new Function('mock', code) as any);
  return fnc;
};

