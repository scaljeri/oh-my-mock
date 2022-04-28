declare let window: any;

export function blurBase64(base64, contentType: string): Promise<string> {
  const img = new window.Image();
  const canvas = window.document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  return new Promise(r => {
    img.onload = () => {
      canvas.height = img.height;
      canvas.width = img.width;
      ctx.filter = 'blur(10px)';
      ctx.drawImage(img, 0, 0, img.width, img.height);

      r(canvas.toDataURL());
    }
    img.src =  `data:${contentType};base64,${base64}`;
  });
}

export function isImage(contentType: string): boolean {
  return contentType && !!contentType.match(/^image\/(?!svg)/);
}

export function stripB64Prefix(b64: string): string {
  return b64.replace(/[^,]+,/, '');
}
