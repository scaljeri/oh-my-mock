import { ownOrigin, ownWindowTarget } from './own-origin';

/**
 * The distinction these two exist for: `window.origin` is the *document's*
 * origin and `window.location.origin` is the *url's*, and they disagree exactly
 * when a document has been made opaque — a `Content-Security-Policy: sandbox`
 * header, a sandboxed iframe, `file://`. Reading the url's origin there and
 * handing it to `postMessage` addressed the wrong origin, and every packet
 * between the page context and the content script was dropped in silence.
 *
 * `window.origin` is a read-only accessor, so the opaque case is set up by
 * redefining the property for the duration of a test rather than assigning it.
 */
describe('own-origin', () => {
  const real = window.origin;

  function withOrigin(value: string, run: () => void): void {
    Object.defineProperty(window, 'origin', { value, configurable: true });

    try {
      run();
    } finally {
      Object.defineProperty(window, 'origin', { value: real, configurable: true });
    }
  }

  it('reports the document origin, not the url origin', () => {
    withOrigin('null', () => {
      expect(ownOrigin()).toBe('null');
      // The whole point: the url still has a perfectly ordinary origin, and
      // reading that one is the bug.
      expect(window.location.origin).not.toBe('null');
    });
  });

  it('addresses an ordinary document by its own origin', () => {
    withOrigin('https://example.com', () => {
      expect(ownWindowTarget()).toBe('https://example.com');
    });
  });

  it('falls back to a wildcard for an opaque document', () => {
    // `postMessage` throws `SyntaxError: Invalid target origin 'null'` — there
    // is no origin string that can address an opaque document.
    withOrigin('null', () => {
      expect(ownWindowTarget()).toBe('*');
    });
  });

  it('falls back to a wildcard when there is no origin at all', () => {
    withOrigin('', () => {
      expect(ownWindowTarget()).toBe('*');
    });
  });
});
