export const splitMimeType = (contentType: string) => {
    const [ mimeType, mimeSubType ] = contentType?.match(/^([^;]+)(;?.*)$/)?.slice(1, 3) || [];

    return { mimeType, mimeSubType };

}

export const isMimeTypeJSON = (contentType: string) => !!contentType?.match(/json$/);