export const splitMimeType = (contentType: string): {mimeType: string, mimeSubType: string} => {
    const [ mimeType, mimeSubType ] = strip(contentType)?.split(/\//);

    return { mimeType, mimeSubType };

}

export function isMimeTypeJSON(contentType: string): boolean  {
    return !!contentType?.match(/json$/);
}

export function extractMimeType(contentType: string): string {
    return (splitMimeType(contentType) || {})?.mimeSubType;
}

export function strip(ct = ''): string {
  return ct.match(/^[^;]{0,}/)[0];
}

export function update(source: string, update: string): string {
  return source.replace(/^[^;]{0,}/, update);
}
