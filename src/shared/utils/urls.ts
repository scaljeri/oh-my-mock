export const url2regex = (url: string): string => {
  // (?<!\\) is a negative look behind, meaning that this regexp can
  // run multiple times on the same url but modifies it only once!
  return url.replace(/(?<!\\)\?/g, '\\?');
}

export const compareUrls = (url, urlRe): boolean => {
  return !!url.match(urlRe);
}