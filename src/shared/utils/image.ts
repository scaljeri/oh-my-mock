export function blurBase64(base64): Promise<string> {
  const img = new Image();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  return new Promise(r => {
    img.onload = () => {
      canvas.height = img.height;
      canvas.width = img.width;
      ctx.filter = 'blur(10px)';
      ctx.drawImage(img, 0, 0, img.width, img.height);

      r(canvas.toDataURL());
    }
    img.src = base64;
  });
}

export function isImage(contentType: string): boolean {
  return !!contentType.match(/^image\/(?!svg)/);
}

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
