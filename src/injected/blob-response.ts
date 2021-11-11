export function toDataURL(response: Blob, cb): void {
  if (typeof response === 'object') {
    const reader = new FileReader();
    reader.onloadend = () => cb(reader.result);
    reader.readAsDataURL(response);
  } else {
    cb(response);
  }
}

// https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript

export function toBlob(base64: string, contentType?: string): Promise<Blob> {
  if (contentType) {
    base64 = `data:${contentType};base64,${base64}`;
  }
  return fetch(base64, { __ohSkip: true } as any).then(res => res.blob());
}
