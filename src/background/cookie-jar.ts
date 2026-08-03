/// <reference types="chrome"/>

import { objectTypes } from '../shared/constants';
import { IOhMyCookie, IOhMyResponseCookie, ohMyCookieId, ohMyDomain } from '../shared/type';
import { CookieUtils } from '../shared/utils/cookie';

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

/**
 * Writes the jar has made itself and that `chrome.cookies.onChanged` has not
 * reported back yet.
 *
 * The recorder listens to that event to pick up what a server sets; without
 * this it would also pick up the extension's own mocks and offer them back as
 * new ones. One entry is consumed per change, so an overwrite (remove + set)
 * still leaves the recorder blind to exactly the one write the jar made.
 */
const ownWrites = new Set<string>();

/** `chrome.cookies` addresses cookies by url, not by bare domain. */
export function cookieUrl(domain: ohMyDomain, path = '/', secure = false): string {
  const scheme = secure || !domain.startsWith('localhost') ? 'https' : 'http';

  return `${scheme}://${domain}${CookieUtils.path(path)}`;
}

export function ownWriteKey(domain: ohMyDomain, name: string, path?: string): string {
  return `${domain}|${name}|${CookieUtils.path(path)}`;
}

/** True — once — for a change the jar caused itself. */
export function consumeOwnWrite(domain: ohMyDomain, name: string, path?: string): boolean {
  return ownWrites.delete(ownWriteKey(domain, name, path));
}

/** Whether this service worker applied the mock and can still unapply it. */
export function isApplied(domain: ohMyDomain, id: ohMyCookieId): boolean {
  return displaced.get(domain)?.has(id) ?? false;
}

function detailsFor(domain: ohMyDomain, cookie: IOhMyCookie): chrome.cookies.SetDetails {
  return {
    url: cookieUrl(domain, cookie.path, cookie.secure),
    name: cookie.name,
    value: cookie.value,
    path: CookieUtils.path(cookie.path),
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

    // `chrome.cookies.get` matches **parent paths**: asking for `/admin` finds
    // a cookie set on `/`. `set` does not — it adds a second cookie at
    // `/admin`. So a parent-path cookie is not displaced by this mock and must
    // not be recorded as such, or unapplying takes the restore branch, rewrites
    // an untouched cookie and never removes the one the mock actually wrote.
    // The mock would then survive every way of switching it off.
    const displacedByThis = !!existing &&
      CookieUtils.path(existing.path) === CookieUtils.path(cookie.path);

    // A cookie already holding the mock's own value is this mock, applied
    // before the service worker was torn down and restarted. Remembering it
    // would make unapplying restore the very mock it is removing.
    forDomain.set(cookie.id,
      displacedByThis && existing.value !== cookie.value ? existing : null);
  }

  ownWrites.add(ownWriteKey(domain, cookie.name, cookie.path));
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

  // Only a cookie on the *same* path is ever recorded as displaced (see
  // `applyCookie`), so writing it back here lands on the mock and replaces it.
  if (previous) {
    ownWrites.add(ownWriteKey(domain, previous.name, previous.path));
    await chrome.cookies.set({
      url,
      name: previous.name,
      value: previous.value,
      path: CookieUtils.path(previous.path),
      httpOnly: previous.httpOnly,
      secure: previous.secure,
      ...(previous.sameSite && { sameSite: previous.sameSite }),
      ...(previous.expirationDate !== undefined && { expirationDate: previous.expirationDate })
    });

    return;
  }

  await chrome.cookies.remove({ url, name: cookie.name });
}

/**
 * Applies every enabled mock for a preset, and unapplies the rest.
 *
 * "The rest" is only what this service worker actually applied. A mock that was
 * never applied has nothing in the jar belonging to it, and removing a cookie
 * of the same name would delete the site's real one — which is how a developer
 * gets logged out by switching a mock *off* that was never on.
 */
export async function syncCookies(
  domain: ohMyDomain,
  cookies: IOhMyCookie[],
  preset: string,
  domainIsActive: boolean
): Promise<void> {
  for (const cookie of cookies) {
    if (domainIsActive && cookie.enabled[preset]) {
      await applyCookie(domain, cookie);
    } else if (isApplied(domain, cookie.id)) {
      await unapplyCookie(domain, cookie);
    }
  }
}

/**
 * The cookies served responses have set on a domain, so they can be taken back
 * out again.
 *
 * Kept here rather than derived from storage because nothing in storage records
 * that a response was *served* — the mock holds the cookies, and whether they
 * are currently in the jar is a fact about this browser session.
 */
const fromResponses = new Map<ohMyDomain, Map<ohMyCookieId, IOhMyCookie>>();

/**
 * The id a response's cookie is tracked under.
 *
 * Name and path, not the response it came from: two responses setting the same
 * cookie are setting the same cookie. Keying on the response would let the
 * second record the first as the "previous value", and unapplying would then
 * restore a mock instead of the site's own cookie.
 */
export function responseCookieId(cookie: IOhMyResponseCookie): ohMyCookieId {
  return `response:${CookieUtils.path(cookie.path)}:${cookie.name}`;
}

/** A response's cookie in the shape the jar works in. */
function asCookieMock(cookie: IOhMyResponseCookie): IOhMyCookie {
  return {
    ...cookie,
    id: responseCookieId(cookie),
    version: '',
    type: objectTypes.COOKIE,
    // A response is already chosen per preset, so its cookies have no switch of
    // their own — and nothing here reads this.
    enabled: {}
  };
}

/**
 * Writes the cookies a served response sets.
 *
 * The caller waits for this before the body reaches the page: a call made on
 * load usually exists to hand the *next* call a cookie, and delivering the body
 * first would race it.
 */
export async function applyResponseCookies(
  domain: ohMyDomain,
  cookies: IOhMyResponseCookie[]
): Promise<void> {
  const applied = fromResponses.get(domain) ?? new Map<ohMyCookieId, IOhMyCookie>();
  fromResponses.set(domain, applied);

  for (const cookie of cookies) {
    const asMock = asCookieMock(cookie);

    applied.set(asMock.id, asMock);
    await applyCookie(domain, asMock);
  }
}

/**
 * Takes back every cookie a response set on this domain.
 *
 * Switching mocking off has to undo these as well as the standalone mocks, or a
 * fabricated session outlives the mocking that fabricated it — which is the
 * failure the whole displace-and-restore dance exists to prevent.
 */
export async function unapplyResponseCookies(domain: ohMyDomain): Promise<void> {
  const applied = fromResponses.get(domain);

  if (!applied) {
    return;
  }

  fromResponses.delete(domain);

  for (const cookie of applied.values()) {
    if (isApplied(domain, cookie.id)) {
      await unapplyCookie(domain, cookie);
    }
  }
}

/** Test seam: drops the remembered originals for a domain. */
export function forgetDisplaced(domain?: ohMyDomain): void {
  ownWrites.clear();

  if (domain) {
    displaced.delete(domain);
    fromResponses.delete(domain);

    return;
  }

  displaced.clear();
  fromResponses.clear();
}
