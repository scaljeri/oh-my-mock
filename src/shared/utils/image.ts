/**
 * Blurs a base64 image, for the `blurImages` setting.
 *
 * This file used to open with `declare let window: any`, which replaced the
 * DOM's `window` with an untyped one and hid both failure modes below. Both end
 * the same way when they are not handled: the promise never settles, and the
 * request waiting on the blurred body waits for good.
 */
export function blurBase64(base64: string, contentType: string): Promise<string> {
  const img = new Image();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  return new Promise((resolve, reject) => {
    // `getContext` yields null when the browser will not give out a 2d context.
    // Resolving with the input would hand the page back the very image the
    // setting exists to hide, so this fails rather than failing open.
    if (!ctx) {
      reject(new Error('Cannot blur the image: no 2d canvas context'));
      return;
    }

    img.onload = () => {
      canvas.height = img.height;
      canvas.width = img.width;
      ctx.filter = 'blur(10px)';
      ctx.drawImage(img, 0, 0, img.width, img.height);

      resolve(canvas.toDataURL());
    }
    img.onerror = () => reject(new Error(`Cannot blur the image: the ${contentType} data did not decode`));
    img.src =  `data:${contentType};base64,${base64}`;
  });
}

/**
 * Whether a content type names a bitmap image (SVG excluded — it is text).
 *
 * A type predicate rather than a plain boolean, and the parameter is optional:
 * a header set need not carry a content type, and the body already treated a
 * missing one as "not an image". Saying so in the signature lets callers narrow
 * — every one of them goes on to use the content type inside the `if`.
 */
export function isImage(contentType?: string): contentType is string {
  return !!contentType && !!contentType.match(/^image\/(?!svg)/);
}

export function stripB64Prefix(b64: string): string {
  return b64.replace(/[^,]+,/, '');
}
