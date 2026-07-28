/// <reference types="chrome"/>

import { IOhMyCookie, ohMyCookieId, ohMyDomain } from '../shared/type';

/**
 * Applies and unapplies cookie mocks.
 *
 * Lives in the background because that is the only context with
 * `chrome.cookies` — which is also why the extension never has to strip
 * `httpOnly`. See `docs/architecture/cookie-mocking.md`.
 *
 * The part that matters is unapplying. Overwriting a real session cookie and
 * then deleting it when mocking is switched off would log the developer out of
 * the site they were testing, which is a worse outcome than not mocking at all.
 * So whatever was there before is recorded and put back.
 */

/** What was in the jar before a mock overwrote it, or `null` if nothing was. */
type Displaced = chrome.cookies.Cookie | null;

/**
 * Remembered per domain, then per cookie mock. Kept in memory only: the
 * service worker may be torn down, and a stale "previous value" from an earlier
 * browser session would be worse than none — `unapply` simply removes what it
 * cannot restore.
 */
const displaced = new Map<ohMyDomain, Map<ohMyCookieId, Displaced>>();

/** `chrome.cookies` addresses cookies by url, not by bare domain. */
export function cookieUrl(domain: ohMyDomain, path = '/', secure = false): string {
  const scheme = secure || !domain.startsWith('localhost') ? 'https' : 'http';

  return `${scheme}://${domain}${path.startsWith('/') ? path : `/${path}`}`;
}

function detailsFor(domain: ohMyDomain, cookie: IOhMyCookie): chrome.cookies.SetDetails {
  return {
    url: cookieUrl(domain, cookie.path, cookie.secure),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path ?? '/',
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? false,
    ...(cookie.sameSite && { sameSite: cookie.sameSite }),
    ...(cookie.expirationDate !== undefined && { expirationDate: cookie.expirationDate })
  };
}

/**
 * Sets one cookie mock, remembering what it replaced.
 *
 * Applying the same mock twice must not overwrite the remembered value with the
 * mock's own — otherwise the original is lost and can never be restored.
 */
export async function applyCookie(domain: ohMyDomain, cookie: IOhMyCookie): Promise<void> {
  const forDomain = displaced.get(domain) ?? new Map<ohMyCookieId, Displaced>();
  displaced.set(domain, forDomain);

  if (!forDomain.has(cookie.id)) {
    const existing = await chrome.cookies.get({
      url: cookieUrl(domain, cookie.path, cookie.secure),
      name: cookie.name
    });

    forDomain.set(cookie.id, existing ?? null);
  }

  await chrome.cookies.set(detailsFor(domain, cookie));
}

/**
 * Removes a cookie mock and puts back whatever it displaced.
 *
 * If nothing was displaced the cookie is removed outright; if something was,
 * it is written back with its original flags — including `httpOnly`, which is
 * why this has to run in the background.
 */
export async function unapplyCookie(domain: ohMyDomain, cookie: IOhMyCookie): Promise<void> {
  const forDomain = displaced.get(domain);
  const previous = forDomain?.get(cookie.id);
  const url = cookieUrl(domain, cookie.path, cookie.secure);

  forDomain?.delete(cookie.id);

  if (previous) {
    await chrome.cookies.set({
      url,
      name: previous.name,
      value: previous.value,
      path: previous.path,
      httpOnly: previous.httpOnly,
      secure: previous.secure,
      ...(previous.sameSite && { sameSite: previous.sameSite }),
      ...(previous.expirationDate !== undefined && { expirationDate: previous.expirationDate })
    });

    return;
  }

  await chrome.cookies.remove({ url, name: cookie.name });
}

/** Applies every enabled mock for a preset, and unapplies the rest. */
export async function syncCookies(
  domain: ohMyDomain,
  cookies: IOhMyCookie[],
  preset: string,
  domainIsActive: boolean
): Promise<void> {
  for (const cookie of cookies) {
    const shouldApply = domainIsActive && cookie.enabled[preset];

    await (shouldApply ? applyCookie(domain, cookie) : unapplyCookie(domain, cookie));
  }
}

/** Test seam: drops the remembered originals for a domain. */
export function forgetDisplaced(domain?: ohMyDomain): void {
  if (domain) {
    displaced.delete(domain);

    return;
  }

  displaced.clear();
}
