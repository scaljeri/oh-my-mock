export const url2regex = (url: string): string => {
  // (?<!\\) is a negative look behind, meaning that this regexp can
  // run multiple times on the same url but modifies it only once!
  return url.replace(/(?<!\\)\?/g, '\\?').replace(/(?<!\\)\./g, '\\.');
};

export const compareUrls = (url: string, urlRe: string): boolean => {
  if (urlRe[0] !== '^') {
    urlRe = '^' + urlRe;
  }

  if (urlRe.charAt(urlRe.length - 1) !== '$') {
    urlRe += '$';
  }

  return !!url.match(urlRe);
};

// The class used to be written `[^:/\?\#]`. Inside a character class `?` and
// `#` are already literal, so the backslashes said nothing; `urls.spec.ts`
// pins the host this picks out either way.
export const stripUrl = (url: string): string => url?.match(/(?:https?:\/\/)?([^:/?#]+)/)?.[1] ?? '';
