export function getMimeType(headers: Record<string, string>): string {
  return headers?.['content-type'];
}
export const splitMimeType = (contentType: string): { mimeType: string, mimeSubType: string } => {
  const [mimeType, mimeSubType] = strip(contentType)?.split(/\//);

  return { mimeType, mimeSubType };

}

export function isMimeTypeJSON(contentType: string): boolean {
  return !!contentType?.match(/\/json/);
}

export function isMimeTypeText(contentType: string): boolean {
  return !!contentType?.match(/\/text/);
}

export function extractMimeType(contentType: string | Record<string, string>): string {
  if (typeof contentType === 'object') {
    contentType = getMimeType(contentType);
  }

  return (splitMimeType(contentType) || {})?.mimeSubType;
}

export function strip(ct = ''): string {
  return ct.match(/^[^;]{0,}/)[0];
}

export function update(source = '', update: string): string {
  return source.replace(/^[^;]{0,}/, update);
}
