import { debugBuilder, errorBuilder, isDebugEnabled, logging, warnBuilder } from './logging';

/**
 * The debug switch, and the reason it has a test at all.
 *
 * `__OH_MY_SHOW_DEBUG__` is replaced at build time by `scripts/token-replace.js`
 * with `'true'` only for a beta version. It once stopped being referenced by any
 * source file while the script went on substituting it, so every build shipped
 * with debug output on and no way to turn it off — silently, because a token
 * nobody reads still "replaces" fine. These tests fail if the reader disappears
 * again.
 *
 * Under Jest nothing replaces the token, so it reads as its literal self: not
 * `'true'`, therefore off. That is the safe default on purpose — a bundle that
 * never reached the replace step should be quiet rather than noisy.
 */
describe('Utils/logging', () => {
  describe('the debug switch', () => {
    it('is off unless the build replaced the token with "true"', () => {
      expect(isDebugEnabled()).toBe(false);
    });

    it('makes debug() a no-op while it is off', () => {
      const spy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);

      debugBuilder()('anything at all');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  /**
   * Only `debug` is switchable. A warning or an error is not noise to be turned
   * off — if either of those is firing, something wants reading.
   */
  describe('the levels that are never switched off', () => {
    it('still warns', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      warnBuilder()('a warning');

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('still errors', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      errorBuilder()('an error');

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  /**
   * One style per `%c`. The format is the prefix (five) plus one in front of the
   * message, so six styles always go ahead of whatever the caller passed.
   *
   * The sixth used to be added only when the second argument was an object or
   * absent — so a **string** lined up with that `%c` and was consumed as CSS.
   * `logMocked` passes one for every non-JSON mock body, so the body of every
   * text, html and image mock vanished from the extension's main log line.
   */
  describe('a string as the second argument', () => {
    it('is printed, not swallowed as a style', () => {
      const handler = jest.fn();

      logging({ handler })('Mocked GET /api/x ->', 'the response body');

      const [format, ...args] = handler.mock.calls[0];
      const placeholders = (format.match(/%c/g) ?? []).length;

      // Six styles for six `%c`, and the caller's string after them — where the
      // console prints it as data.
      expect(placeholders).toBe(6);
      expect(args).toHaveLength(placeholders + 1);
      expect(args[placeholders]).toBe('the response body');
    });

    it('lines a caller own %c up with the style it passed', () => {
      const handler = jest.fn();

      logging({ handler })('status: %cERROR', 'color: red');

      const [format, ...args] = handler.mock.calls[0];
      const placeholders = (format.match(/%c/g) ?? []).length;

      // Seven `%c` — five prefix, one ours, one theirs — and seven styles, so
      // theirs lands on their own span rather than a slot early.
      expect(placeholders).toBe(7);
      expect(args).toHaveLength(7);
      expect(args[6]).toBe('color: red');
    });

    it('still leaves an object where it was', () => {
      const handler = jest.fn();
      const detail = { id: 1 };

      logging({ handler })('Something happened', detail);

      const [, ...args] = handler.mock.calls[0];

      expect(args[args.length - 1]).toBe(detail);
    });
  });
});
