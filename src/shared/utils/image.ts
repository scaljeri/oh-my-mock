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
