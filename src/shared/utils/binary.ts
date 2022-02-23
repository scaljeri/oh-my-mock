import { IS_BASE64_RE } from "../constants";
import { isImage } from "./image";

// TODO

export function isBinary(contentType: string): boolean {
  return isImage(contentType);
}

export function isBase64Str(input: string): boolean {
  return IS_BASE64_RE.test(input);
}

export function toDataURL(response: Blob, cb?): Promise<string> {
  return new Promise(r => {
    if (typeof response === 'object') {
      const reader = new FileReader();
      reader.onloadend = () => {
        cb?.(reader.result);
        r(reader.result as string);
      }
      reader.readAsDataURL(response);
    } else {
      cb?.(response);
      r(response as string);
    }
  });
}

// https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript

// @Deprecated
export function toBlob(base64: string, contentType?: string): Promise<Blob> {
  if (contentType) {
    base64 = `data:${contentType};base64,${base64}`;
  }
  return fetch(base64, { __ohSkip: true } as any).then(res => res.blob());
}

// TODO: does this work the same way as toBlob?????
export function b64toBlob(b64Data: string, contentType = '', sliceSize = 512) {
  const byteCharacters = window.atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
}
