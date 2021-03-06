export const parse = (headers: string): Record<string, string> => {
  return headers.split('\r\n').reduce((s, n) => {
    if (n) {
      const split = n.split(': ');
      s[split[0]] = split[1];
    }

    return s;
  }, {});
}

export const stringify = (headers: Record<string, string>): string => {
  return Object.entries(headers).reduce((out, input) => {
    out.push(`${input[0]}: ${input[1]}`);
    return out;
  }).join('\r\n');
}

export const getHeaderKeys = (headers: string): string[] => {
  return headers.match(/(?<=\b)(..*)(?=: )/g);
}

export const getHeaderValues = (headers: string): string[] => {
  return headers.match(/(?<=: )(.*)(?=\b)/g);
}
