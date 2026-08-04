import { warnBuilder } from './logging';

const warn = warnBuilder({ prefix: 'OhMyMock' });

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

/** Patterns already found to be invalid, so each is complained about once. */
const broken = new Set<string>();

/**
 * Whether a stored pattern matches a url.
 *
 * **A pattern that is not a valid regex matches nothing, rather than throwing.**
 * `IData.url` is stored as a regex and `url2regex` escapes what the UI captures,
 * but a hand-edited url or one from an imported backup goes in raw. The throw
 * happened inside `findRequest`'s `.find()`, which aborts the whole scan — so a
 * single malformed url stopped **every** mock on that domain from being found,
 * and the throw then propagated into a promise nobody was catching, leaving the
 * page's request pending for ever.
 *
 * One broken mock should break one mock.
 */
export const compareUrls = (url: string, urlRe: string): boolean => {
  if (urlRe[0] !== '^') {
    urlRe = '^' + urlRe;
  }

  if (urlRe.charAt(urlRe.length - 1) !== '$') {
    urlRe += '$';
  }

  try {
    return !!url.match(urlRe);
  } catch {
    // Once per pattern: this runs for every candidate of every intercepted
    // request, and a page making a hundred calls would otherwise print a
    // hundred identical warnings.
    if (!broken.has(urlRe)) {
      broken.add(urlRe);
      warn(`Not a valid pattern, so it will never match anything: ${urlRe}`);
    }

    return false;
  }
};

// The class used to be written `[^:/\?\#]`. Inside a character class `?` and
// `#` are already literal, so the backslashes said nothing; `urls.spec.ts`
// pins the host this picks out either way.
export const stripUrl = (url: string): string => url?.match(/(?:https?:\/\/)?([^:/?#]+)/)?.[1] ?? '';
