export const splitMimeType = (contentType: string): {mimeType: string, mimeSubType: string} => {
    const [ mimeType, mimeSubType ] = contentType?.match(/^([^;]+)(;?.*)$/)?.slice(1, 3) || [];

    return { mimeType, mimeSubType };

}

export function isMimeTypeJSON(contentType: string): boolean  {
    return !!contentType?.match(/json$/);
}

export function extractMimeType(contentType: string): string {
    return (splitMimeType(contentType) || {}).mimeSubType;
}