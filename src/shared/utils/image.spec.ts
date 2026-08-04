import { blurBase64, forgetBlurred, isImage, stripB64Prefix } from './image';

/**
 * The blur was redone on every intercepted call, while the page waited for its
 * body — decode, draw, blur, re-encode, for a result fully determined by the
 * image that went in. So a page asking for the same mocked image twenty times
 * blurred the same image twenty times.
 *
 * `Image` and `<canvas>` do not really render under jsdom, so what is stubbed
 * here is the drawing; what is tested is how often it happens.
 */
describe('blurBase64', () => {
  let drawn: number;
  let originalImage: typeof Image;

  beforeEach(() => {
    forgetBlurred();
    drawn = 0;

    originalImage = window.Image;

    // Fires `onload` on the next tick, the way a decoded image would.
    (window as unknown as { Image: unknown }).Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 2;
      height = 2;

      set src(_value: string) {
        setTimeout(() => this.onload?.());
      }
    };

    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(
        () =>
          ({
            filter: '',
            drawImage: () => {
              drawn++;
            }
          }) as unknown as CanvasRenderingContext2D
      );

    jest
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockImplementation(() => `blurred-${drawn}`);
  });

  afterEach(() => {
    (window as unknown as { Image: unknown }).Image = originalImage;
    jest.restoreAllMocks();
  });

  it('blurs the image it is given', async () => {
    expect(await blurBase64('AAAA', 'image/png')).toBe('blurred-1');
    expect(drawn).toBe(1);
  });

  it('does not blur the same image twice', async () => {
    const first = await blurBase64('AAAA', 'image/png');
    const second = await blurBase64('AAAA', 'image/png');

    expect(second).toBe(first);
    expect(drawn).toBe(1);
  });

  /**
   * Keyed on the content, so it cannot go stale: editing the body of a mock
   * produces a different key rather than a wrong answer.
   */
  it('blurs again when the image changes', async () => {
    await blurBase64('AAAA', 'image/png');
    await blurBase64('BBBB', 'image/png');

    expect(drawn).toBe(2);
  });

  it('blurs again when only the content type differs', async () => {
    await blurBase64('AAAA', 'image/png');
    await blurBase64('AAAA', 'image/gif');

    expect(drawn).toBe(2);
  });

  /** The values are whole images, so the cache is bounded. */
  it('does not grow without limit', async () => {
    for (let i = 0; i < 20; i++) {
      await blurBase64(`image-${i}`, 'image/png');
    }

    // The first is gone, so asking for it again is a fresh blur.
    const before = drawn;
    await blurBase64('image-0', 'image/png');
    expect(drawn).toBe(before + 1);

    // The most recent is still there.
    const after = drawn;
    await blurBase64('image-19', 'image/png');
    expect(drawn).toBe(after);
  });

  /**
   * Resolving with the input would hand the page the very image the setting
   * exists to hide, so a browser that will not give out a context is a failure
   * rather than a pass-through — and nothing is remembered.
   */
  it('rejects rather than failing open when there is no canvas context', async () => {
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => null);

    await expect(blurBase64('AAAA', 'image/png')).rejects.toThrow(
      'no 2d canvas context'
    );
  });
});

describe('isImage', () => {
  it('is true for a bitmap type and false for svg', () => {
    expect(isImage('image/png')).toBe(true);
    expect(isImage('image/svg+xml')).toBe(false);
    expect(isImage(undefined)).toBe(false);
  });
});

describe('stripB64Prefix', () => {
  it('drops the data url prefix', () => {
    expect(stripB64Prefix('data:image/png;base64,AAAA')).toBe('AAAA');
    expect(stripB64Prefix('AAAA')).toBe('AAAA');
  });
});
