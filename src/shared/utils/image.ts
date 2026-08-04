/**
 * Blurs a base64 image, for the `blurImages` setting.
 *
 * This file used to open with `declare let window: any`, which replaced the
 * DOM's `window` with an untyped one and hid both failure modes below. Both end
 * the same way when they are not handled: the promise never settles, and the
 * request waiting on the blurred body waits for good.
 */
/**
 * Blurred images, keyed on the image that went in.
 *
 * The blur was redone on **every** intercepted call: decode, draw, blur,
 * re-encode, while the page waited for its body. The result is fully determined
 * by the base64 and the content type, neither of which changes between two
 * calls to the same mock — so a page asking for the same image twenty times
 * blurred the same image twenty times.
 *
 * Keyed on the content, like the compiled url patterns, so it cannot go stale:
 * editing the mock's body produces a different key. Bounded because the values
 * are whole images and the key is one too — the key at least is a string the
 * mock record already holds.
 */
const blurred = new Map<string, string>();

/** How many blurred images to keep. They are large; a handful is plenty. */
const MAX_BLURRED = 16;

/** Remembers a blurred image, dropping the oldest once the cache is full. */
function remember(key: string, value: string): string {
  blurred.set(key, value);

  if (blurred.size > MAX_BLURRED) {
    const oldest = blurred.keys().next();

    if (!oldest.done) {
      blurred.delete(oldest.value);
    }
  }

  return value;
}

/** Test seam: forgets every blurred image. */
export function forgetBlurred(): void {
  blurred.clear();
}

export function blurBase64(base64: string, contentType: string): Promise<string> {
  const key = `${contentType}|${base64}`;
  const cached = blurred.get(key);

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

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

      resolve(remember(key, canvas.toDataURL()));
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
