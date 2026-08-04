import { STORAGE_KEY } from '../constants';

export interface IOhMyLoggingConfig {
  /**
   * Where the line goes. Always one of the `console` methods — the builders
   * below pick `console.debug`/`warn`/`error`, and `logging` falls back to
   * `console.log` — so the signature is a console method's: a format string
   * followed by the `%c` substitutions and whatever else the caller passed.
   */
  handler?: (message: string, ...rest: unknown[]) => void,
  styles?: string;
  prefix?: string;
}

export const PREFIX_STYLES_BASE = [
  'background: black;color: white;padding: 3px 0 3px 3px',
  'background: black;color: pink;padding: 3px 0',
  'background: black;color: red;padding: 3px 0',
  'background: black;color: pink;padding: 3px 0',
  'background: black;color: white;font-family;monospace;padding:3px 0 3px 0;margin-right:5px'];
export const PREFIX_STYLES_APPEND = 'background: inherit; color: inherit;monospace;padding:5px';

/* eslint-disable no-console */

const LOG_PREFIX = `%c(%c^%c*%c^%c) ${STORAGE_KEY}`;

/**
 * Replaced at build time by `scripts/token-replace.js`, with `'true'` only for a
 * beta version. Anything else — including the token left as it is, which is what
 * an unbuilt or half-built bundle carries — counts as off, so a build that never
 * reached the replace step is quiet rather than noisy.
 */
// Typed as `string`, not left to be narrowed to its own literal: the value is
// substituted at build time, so comparing it is the point rather than, as the
// compiler would otherwise have it, provably pointless.
const SHOW_DEBUG: string = '__OH_MY_SHOW_DEBUG__';

/**
 * Whether `debug()` writes anything.
 *
 * This switch existed, stopped being referenced by anything, and nobody noticed:
 * `token-replace.js` went on substituting a token that no longer appeared in the
 * source, so every build shipped with debug output on and no way to turn it off.
 * `logging.spec.ts` now fails if the token loses its reader again.
 */
export const isDebugEnabled = (): boolean => SHOW_DEBUG === 'true';

export const logging = (config: IOhMyLoggingConfig = {}) => {
  return (msg: string, ...rest: (string | unknown)[]) => {
    // One style per `%c`, always. The format is `LOG_PREFIX` (five `%c`) plus
    // one more in front of the message, so six styles have to go in front of
    // whatever the caller passed.
    //
    // The sixth used to be added only when `rest[0]` was an object or absent.
    // A **string** second argument therefore lined up with that `%c` and was
    // consumed as CSS — it never appeared at all. `logMocked` passes one for
    // every non-JSON mock body, so the body of every text, html or image mock
    // vanished from the extension's main diagnostic line.
    //
    // It was equally wrong the other way: a caller writing its own `%c` in
    // `msg` and passing a style had that style eaten by *our* `%c`, leaving
    // theirs to take the next argument. Everything shifted by one.
    rest.unshift(...PREFIX_STYLES_BASE, PREFIX_STYLES_APPEND);

    (config?.handler || console.log)(`${LOG_PREFIX} %c${msg}`, ...rest);
  }
}

export const debugBuilder = (config: IOhMyLoggingConfig = {}) => {
  if (!isDebugEnabled()) {
    return () => undefined;
  }

  return logging({ handler: console.debug, ...config });
}

export const logBuilder = (config?: IOhMyLoggingConfig) => {
  return logging(config);
}

export const warnBuilder = (config: IOhMyLoggingConfig = {}) => {
  return logging({
    styles: 'background: yellow; color: #fff',
    handler: console.warn, ...config
  });
}

export const errorBuilder = (config: IOhMyLoggingConfig = {}) => {
  return logging({
    styles: 'background: red; color: #fff', handler: console.error, ...config
  });
}

