import { IS_BASE64_RE } from "../constants";
import { isImage } from "./image";

// TODO

export async function convertToB64(input: Blob | ArrayBuffer | string): Promise<string> {
  if (typeof input === 'string') {
    return input;
  } else if (input instanceof ArrayBuffer) {
    return arrayBufferToB64(input);
  } else {
    return blobToDataURL(input);
  }
}

export function isBinary(contentType: string): boolean {
  return isImage(contentType);
}

export function isBase64Str(input: string): boolean {
  return IS_BASE64_RE.test(input);
}

export function blobToDataURL(response: Blob, cb?): Promise<string> {
  return new Promise(r => {
    if (typeof response === 'object') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const b64Str = (reader.result as string).split(',')[1];
        cb?.(b64Str);
        r(b64Str);
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
// export function _b64ToBlob(base64: string, contentType?: string): Promise<Blob> {
//   if (contentType) {
//     // base64 = `data:${contentType};base64,${base64}`;
//   }
//   return fetch(base64, { __ohSkip: true } as any).then(res => res.blob());
// }

// TODO: does this work the same way as toBlob?????
export function b64ToBlob(b64Data: string, contentType = '', sliceSize = 512) {
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

export function arrayBufferToB64(buffer: ArrayBuffer): string {
  /*
  let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
    */
  // return window.btoa(String.fromCharCode(...buffer));

  // return `data:${contentType};base64,${window.btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
  return `${window.btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
}

export function b64ToArrayBuffer(b64: string): Uint8Array {
  const asciiString = window.atob(b64);

  return new Uint8Array([...asciiString].map(char => char.charCodeAt(0)));
}
