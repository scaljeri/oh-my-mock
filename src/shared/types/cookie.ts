import { objectTypes } from '../constants';
import { ohMyPresetId } from './preset';

export type ohMyCookieId = string;

/**
 * What a cookie *is*: the fields that decide whether the browser sends it.
 *
 * Shaped after `chrome.cookies` rather than a bare name/value pair. Two things
 * carry these — a standalone cookie mock for a domain, and a cookie a saved
 * response sets — and they agree on the cookie itself while differing in what
 * decides when it exists.
 */
export interface IOhMyCookieAttributes {
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

}

/**
 * A cookie a **saved response** sets, the way a real `Set-Cookie` would.
 *
 * It has no `enabled` of its own: the response it belongs to is already chosen
 * per preset, so a second switch would be a switch behind a switch.
 *
 * The reason these cannot simply be a `Set-Cookie` header on the response is
 * unchanged — a mocked response is fabricated in the page and never reaches the
 * browser's cookie jar, so such a header is inert. The background writes them
 * with `chrome.cookies` when the response is served, and the response waits for
 * that: a call made on page load usually exists to hand the next call a cookie,
 * and delivering the body first would race it.
 */
export type IOhMyResponseCookie = IOhMyCookieAttributes;

/**
 * A cookie mock that stands on its own, for a domain.
 *
 * These exist while mocking is on for the site, rather than when some call is
 * made — which is what makes "already logged in before the page does anything"
 * possible. See `docs/architecture/cookie-mocking.md`.
 */
export interface IOhMyCookie extends IOhMyCookieAttributes {
  id: ohMyCookieId;
  version: string;
  type: objectTypes.COOKIE;

  label?: string;
  /** Per preset, like requests: "logged out" is a cookie state too. */
  enabled: Record<ohMyPresetId, boolean>;

  createdOn?: string;
  modifiedOn?: string;
}
