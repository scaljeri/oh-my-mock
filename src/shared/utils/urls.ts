/**
 * Turns a literal url into a pattern that matches exactly that url.
 *
 * `IData.url` is stored as a regex, so a url captured from the page has to be
 * escaped before it can be stored. Only `.` and `?` used to be escaped, which
 * left every other metacharacter live — and a url is allowed to contain them:
 *
 *   `/api/items(new)`  stored as-is, matched `/api/itemsnew`, so **the mock
 *                      never matched the url it was created from**
 *   `/api/a)b`         an unbalanced `)` — `compareUrls` throws a SyntaxError
 *                      inside the content script's lookup
 *
 * `(?<!\\)` is a negative lookbehind, so this can run over its own output and
 * still escape each character only once. A literal backslash in the url is the
 * one thing it cannot handle, since escaping that would break that property;
 * backslashes do not occur in urls.
 */
const RE_METACHARACTERS = /(?<!\\)([.?*+^$()[\]{}|])/g;

export const url2regex = (url: string): string => url.replace(RE_METACHARACTERS, '\\$1');

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
