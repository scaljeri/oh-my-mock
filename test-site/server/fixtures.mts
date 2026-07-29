/**
 * Fixture payloads for the test API.
 *
 * Everything here is deterministic on purpose: tests assert on exact bytes so
 * that a mocked response is trivially distinguishable from a real one. Nothing
 * in this file may depend on the clock, the filesystem or randomness.
 */

/** Marks a payload as coming from the real server rather than from a mock. */
export const SERVER_MARKER = 'server';

export const usersFixture = {
  1: { id: 1, name: 'Ada Lovelace', profession: 'mathematician' },
  2: { id: 2, name: 'Grace Hopper', profession: 'rear admiral' },
  3: { id: 3, name: 'Radia Perlman', profession: 'network engineer' }
};

export const jsonFixture = {
  source: SERVER_MARKER,
  message: 'hello from the test server',
  nested: { list: [1, 2, 3], flag: true }
};

export const htmlFixture = [
  '<!doctype html>',
  '<html lang="en">',
  '<head><meta charset="utf-8"><title>Fixture page</title></head>',
  `<body><h1 id="source">${SERVER_MARKER}</h1><p>Static HTML fixture.</p></body>`,
  '</html>'
].join('\n');

export const textFixture = `plain text from the ${SERVER_MARKER}`;

/** 1x1 red PNG. Small enough to inline, real enough to decode as an image. */
export const pngFixture = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/** 1x1 GIF, used to check that a second image mime type behaves identically. */
export const gifFixture = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export const svgFixture =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>';

/** Deterministic binary blob for arraybuffer / octet-stream assertions. */
export const binaryFixture = Buffer.from(
  Array.from({ length: 256 }, (_, i) => i)
);

/** Builds a payload of a predictable size, for streaming / large-body tests. */
export function largeFixture(sizeKb: number): string {
  // A repeating pattern rather than one character, so truncation is visible.
  const block = 'oh-my-mock-'.repeat(93).slice(0, 1024);
  return block.repeat(sizeKb);
}

/**
 * The cookies `/api/cookies/set` hands out.
 *
 * A spread rather than one of each: cookie mocking has to carry `httpOnly`,
 * `secure`, `sameSite`, `path` and an expiry through storage, the jar and back,
 * and the recorder has to pick every one of them off a real `Set-Cookie`. A
 * fixture that only ever sets a plain session cookie proves none of that.
 *
 * `expirationDate` is deliberately absent here — a fixed timestamp would go
 * stale, so the route derives it (see `PERSISTENT_COOKIE_MAX_AGE_MS`) and this
 * file stays free of the clock.
 */
export interface CookieFixture {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
  /** Persistent when true; a session cookie otherwise. */
  persistent: boolean;
}

/** One hour, so a persistent fixture cookie cannot expire mid-suite. */
export const PERSISTENT_COOKIE_MAX_AGE_MS = 60 * 60 * 1000;

export const cookieFixtures: CookieFixture[] = [
  // The common case: a session cookie the page cannot read. This is what a
  // login sets, and the one whose value a mock must be able to replace.
  { name: 'ohMySession', value: 'session-from-server', httpOnly: true, sameSite: 'lax', path: '/', persistent: false },
  // Readable from `document.cookie`, so a test can tell "the jar has it" from
  // "the page can see it" — the flags are a property of the mock, not global.
  { name: 'ohMyVisible', value: 'visible-from-server', httpOnly: false, sameSite: 'lax', path: '/', persistent: false },
  // Survives a reload: the recorder must carry an expiry rather than silently
  // turning it into a session cookie.
  { name: 'ohMyPersistent', value: 'persistent-from-server', httpOnly: true, sameSite: 'strict', path: '/', persistent: true },
  // Scoped to a sub-path. `chrome.cookies.get` matches *parent* paths while
  // `set` does not, which is where a real bug lived: a mock on `/api/admin`
  // recorded the `/` cookie as the one it displaced, then on unapply rewrote
  // that untouched cookie and left itself in place.
  { name: 'ohMySession', value: 'admin-from-server', httpOnly: true, sameSite: 'lax', path: '/api/admin', persistent: false }
];
