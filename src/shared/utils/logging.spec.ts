import { debugBuilder, errorBuilder, isDebugEnabled, warnBuilder } from './logging';

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
});
