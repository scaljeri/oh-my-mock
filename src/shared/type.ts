/**
 * The barrel over `./types`.
 *
 * Every interface in the project used to live in this file. It is now one file
 * per concept — request, mock, state, store, cookie, preset, context and the
 * two API envelopes — and this re-exports all of them, so the modules that
 * import from `@shared/type` keep working unchanged. Prefer importing the
 * concept file directly (`@shared/types/cookie`) in new code; this exists so
 * that move can happen file by file rather than in one sweep, and the sites
 * that named a single concept have already been moved.
 *
 * Two exports did not survive the split: `statusCode` and `domain`, the
 * aliases marked DEPRECATED since 2021 — use `ohMyStatusCode` and `ohMyDomain`.
 *
 * Messaging types are not here: they have always lived in `./packet-type`.
 */
export * from './types/api-request';
export * from './types/api-response';
export * from './types/context';
export * from './types/cookie';
export * from './types/eval';
export * from './types/mock';
export * from './types/preset';
export * from './types/request';
export * from './types/state';
export * from './types/store';
