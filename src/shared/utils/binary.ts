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

export function toBlob(base64: string, contentType?: string): Promise<Blob> {
  if (contentType) {
    base64 = `data:${contentType};base64,${base64}`;
  }
  return fetch(base64, { __ohSkip: true } as any).then(res => res.blob());
}
