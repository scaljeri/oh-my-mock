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
