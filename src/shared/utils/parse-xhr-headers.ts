export const parseXhrHeaders = (headers: string): Record<string, string> => {
  return headers.split('\r\n').reduce((s, n) => {
    if (n) {
      const split = n.split(': ');
      s[split[0]] = split[1];
    }

    return s;
  }, {});
}

export const getHeaderKeys = (headers: string): string[] => {
  return headers.match(/(?<=\b)(..*)(?=: )/g);
}

export const getHeaderValues = (headers: string): string[] => {
  return headers.match(/(?<=: )(.*)(?=\b)/g);
}
