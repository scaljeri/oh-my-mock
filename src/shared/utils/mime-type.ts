/** A header set need not carry a content type, so this may find nothing. */
export function getMimeType(headers: Record<string, string>): string | undefined {
  return headers?.['content-type'];
}

/**
 * Splits `text/html; charset=utf-8` into its type and subtype.
 *
 * Both parts are optional in the result: `strip` returns `''` for a missing or
 * malformed content type, and `''.split('/')` yields `['']`, so `mimeSubType`
 * is genuinely `undefined` there. It used to be typed as a plain `string`,
 * which is what let `extractMimeType` read a property off it unguarded.
 */
export const splitMimeType = (contentType: string): { mimeType?: string, mimeSubType?: string } => {
  // No `?.` here: `strip` always returns a string. Optional-chaining the call
  // and then destructuring the result would throw on `undefined` rather than
  // guard against it — the array pattern cannot destructure nothing.
  const [mimeType, mimeSubType] = strip(contentType).split(/\//);

  return { mimeType, mimeSubType };
}

export function isMimeTypeJSON(contentType?: string): boolean {
  return !!contentType?.match(/\/json/);
}

export function isMimeTypeText(contentType: string): boolean {
  return !!contentType?.match(/\/text/);
}

export function extractMimeType(contentType?: string | Record<string, string>): string {
  if (typeof contentType === 'object') {
    contentType = getMimeType(contentType);
  }

  return splitMimeType(contentType ?? '').mimeSubType ?? '';
}

export function strip(ct = ''): string {
  return ct.match(/^[^;]{0,}/)?.[0] ?? '';
}

export function update(source = '', update: string): string {
  return source.replace(/^[^;]{0,}/, update);
}
