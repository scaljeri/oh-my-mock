import { Pipe, PipeTransform } from '@angular/core';

/** What the EXPIRES column reads for a cookie without an expiry. */
export const SESSION_COOKIE = 'Session';

/**
 * Formats `IOhMyCookie.expirationDate` the way the EXPIRES column of
 * `design/Mock Manager v2.dc.html` reads it: `Dec 31, 2026`, or `Session`.
 *
 * The stored value is what `chrome.cookies` uses — **seconds** since the epoch,
 * not milliseconds. Multiplying by the wrong factor puts every cookie in 1970,
 * which is why the conversion lives in one tested place.
 */
export function formatCookieExpiry(expirationDate?: number | null): string {
  if (expirationDate === undefined || expirationDate === null || !Number.isFinite(expirationDate)) {
    return SESSION_COOKIE;
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(expirationDate * 1000));
}

@Pipe({ name: 'ohCookieExpiry', standalone: false })
export class CookieExpiryPipe implements PipeTransform {
  transform(expirationDate?: number | null): string {
    return formatCookieExpiry(expirationDate);
  }
}
