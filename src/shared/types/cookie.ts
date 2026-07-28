import { objectTypes } from '../constants';
import { ohMyPresetId } from './preset';

export type ohMyCookieId = string;

/**
 * A cookie the extension sets on a domain.
 *
 * Its own record, not a field on a response: a mocked response is fabricated in
 * the page and never reaches the browser's cookie jar, so a `Set-Cookie` header
 * stored on one is inert. See `docs/architecture/cookie-mocking.md`.
 *
 * Shaped after `chrome.cookies` rather than a bare name/value pair, because
 * these are the fields that decide whether the browser actually sends it.
 */
export interface IOhMyCookie {
  id: ohMyCookieId;
  version: string;
  type: objectTypes.COOKIE;

  name: string;
  value: string;
  path?: string;
  /**
   * Kept as a real property rather than stripped. The extension sets cookies
   * from the background, where `chrome.cookies` can write httpOnly ones
   * directly — so there is never a reason to weaken the site under test.
   */
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'no_restriction' | 'lax' | 'strict';
  /** Absent means a session cookie. */
  expirationDate?: number;

  label?: string;
  /** Per preset, like requests: "logged out" is a cookie state too. */
  enabled: Record<ohMyPresetId, boolean>;

  createdOn?: string;
  modifiedOn?: string;
}
