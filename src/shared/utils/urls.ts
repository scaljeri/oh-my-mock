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

/**
 * Whether a pattern already ends in an end-of-string anchor.
 *
 * Looking at the last character alone was not enough: `url2regex` escapes a
 * literal `$` in a url to `\$`, and that also ends in `$`. So a stored pattern
 * for `/api/x$` was left unanchored, and matched `/api/x$anything`.
 *
 * An anchor is a `$` preceded by an even number of backslashes — zero being
 * even. An odd number means the last one escapes the `$`, making it a literal.
 */
const endsAnchored = (pattern: string): boolean => {
  if (pattern.charAt(pattern.length - 1) !== '$') {
    return false;
  }

  let backslashes = 0;

  for (let i = pattern.length - 2; i >= 0 && pattern.charAt(i) === '\\'; i--) {
    backslashes++;
  }

  return backslashes % 2 === 0;
};

/**
 * Stored patterns, compiled once.
 *
 * `compareUrls` handed a **string** to `url.match()`, so the engine turned it
 * into a `RegExp` on every call — for every candidate, on every intercepted
 * request, and again for every unmocked response on the recording path.
 *
 * `null` marks a pattern that is not a valid regex, so a broken one is compiled
 * once and rejected from a lookup thereafter rather than throwing again.
 *
 * Keyed on the pattern text itself, which is what makes this safe to keep
 * forever: the key *is* the content, so an entry cannot go stale. Editing a
 * mock's url produces a different key.
 */
const compiled = new Map<string, RegExp | null>();

/**
 * The anchored `RegExp` for a stored url pattern, or `null` if it is not one.
 *
 * A pattern that cannot be compiled matches nothing rather than throwing. The
 * throw used to happen inside `findRequest`'s `.find()`, which aborts the whole
 * scan — so a single malformed url stopped **every** mock on that domain from
 * being found.
 */
export function patternFor(urlRe: string): RegExp | null {
  const cached = compiled.get(urlRe);

  if (cached !== undefined) {
    return cached;
  }

  let source = urlRe;

  if (source[0] !== '^') {
    source = '^' + source;
  }

  if (!endsAnchored(source)) {
    source += '$';
  }

  try {
    const pattern = new RegExp(source);
    compiled.set(urlRe, pattern);

    return pattern;
  } catch {
    compiled.set(urlRe, null);
    warn(`Not a valid pattern, so it will never match anything: ${urlRe}`);

    return null;
  }
}

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
  const pattern = patternFor(urlRe);

  return !!pattern && pattern.test(url);
};

// The class used to be written `[^:/\?\#]`. Inside a character class `?` and
// `#` are already literal, so the backslashes said nothing; `urls.spec.ts`
// pins the host this picks out either way.
export const stripUrl = (url: string): string => url?.match(/(?:https?:\/\/)?([^:/?#]+)/)?.[1] ?? '';
