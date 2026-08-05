/// <reference types="chrome"/>

import { objectTypes } from '../shared/constants';
import { IOhMyCookie, IOhMyResponseCookie, IState, ohMyCookieId, ohMyDomain } from '../shared/type';
import { CookieUtils } from '../shared/utils/cookie';
import { StorageUtils } from '../shared/utils/storage';
import { error } from './utils';

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

/**
 * One piece of cookie work per domain at a time.
 *
 * A sync is a read-modify-write over the jar and the `displaced` map, with
 * awaits in the middle. Nothing used to keep two of them apart:
 * `handleStorageUpdate` fires without being awaited, so two quick toggles ran
 * two syncs for one domain at once, interleaving across those awaits — the
 * second sync asked `isApplied` before the first had recorded anything, decided
 * there was nothing to undo, and the record of what was displaced was lost.
 * Every entry point that mutates a domain's cookies goes through here; the
 * helpers they call (`applyCookie`, `syncCookies`, `unapplyResponseCookies`…)
 * deliberately do not, so a task never waits on itself.
 */
const domainQueues = new Map<ohMyDomain, Promise<unknown>>();

export function serialiseCookieWork<T>(domain: ohMyDomain, task: () => Promise<T>): Promise<T> {
  const run = (domainQueues.get(domain) ?? Promise.resolve()).then(task, task);

  // The chain has to survive a failing task; the failure itself still belongs
  // to that task's caller, which gets it through `run`.
  domainQueues.set(domain, run.catch(() => undefined));

  return run;
}

/** What was in the jar before a mock overwrote it, or `null` if nothing was. */
type Displaced = chrome.cookies.Cookie | null;

/**
 * What each mock overwrote, per domain and then per mock.
 *
 * Mirrored into `chrome.storage.session`, which is the whole reason restoring
 * works at all. MV3 tears the service worker down after about thirty seconds of
 * idle, so keeping this in memory meant a restore only happened when switching
 * a mock *off* fell in the same worker life as switching it on. Any other time
 * `unapplyCookie` found nothing recorded and removed the cookie outright —
 * deleting the site's real session cookie and logging the developer out of the
 * site under test. That is the exact outcome this module exists to prevent, and
 * it was the ordinary path rather than the edge.
 *
 * The comment that justified memory-only reasoned that "a stale previous value
 * from an earlier browser session would be worse than none". True, and session
 * storage has precisely that lifetime: it is cleared when the browser closes.
 * The worry was right; the conclusion did not follow.
 */
const displaced = new Map<ohMyDomain, Map<ohMyCookieId, Displaced>>();

/** Where `displaced` and `fromResponses` are mirrored. */
const DISPLACED_KEY = 'OhMyDisplacedCookies';
const RESPONSES_KEY = 'OhMyResponseCookies';

/**
 * Reads both mirrors back, once per worker life.
 *
 * Every mutator awaits this before touching either map, and that ordering is
 * the point. Writing back is a whole-map serialise, so a worker that was woken
 * *by* a cookie-setting request would otherwise apply first and write its
 * single new entry over everything the previous worker had recorded — losing
 * exactly the records that make restoring possible. Priming on a timer at
 * startup does not fix that, because the message is what wakes the worker: it
 * arrives first.
 */
let priming: Promise<void> | undefined;

function primed(): Promise<void> {
  priming ??= (async () => {
    try {
      const stored = await chrome.storage.session.get([DISPLACED_KEY, RESPONSES_KEY]);

      for (const [domain, entries] of Object.entries(
        (stored?.[DISPLACED_KEY] ?? {}) as Record<ohMyDomain, Record<ohMyCookieId, Displaced>>
      )) {
        const forDomain = displaced.get(domain) ?? new Map<ohMyCookieId, Displaced>();
        displaced.set(domain, forDomain);

        for (const [id, previous] of Object.entries(entries)) {
          if (!forDomain.has(id)) {
            forDomain.set(id, previous);
          }
        }
      }

      for (const [domain, cookies] of Object.entries(
        (stored?.[RESPONSES_KEY] ?? {}) as Record<ohMyDomain, IOhMyCookie[]>
      )) {
        const applied = fromResponses.get(domain) ?? new Map<ohMyCookieId, IOhMyCookie>();
        fromResponses.set(domain, applied);

        for (const cookie of cookies) {
          if (!applied.has(cookie.id)) {
            applied.set(cookie.id, cookie);
          }
        }
      }
    } catch (err) {
      error('Could not read back what the cookie mocks displaced', err);
    }
  })();

  return priming;
}

/** Mirrors both maps. Failure is logged, not thrown — the jar is still right. */
async function remember(): Promise<void> {
  const asPlainDisplaced: Record<ohMyDomain, Record<ohMyCookieId, Displaced>> = {};

  for (const [domain, entries] of displaced) {
    asPlainDisplaced[domain] = Object.fromEntries(entries);
  }

  const asPlainResponses: Record<ohMyDomain, IOhMyCookie[]> = {};

  for (const [domain, applied] of fromResponses) {
    asPlainResponses[domain] = [...applied.values()];
  }

  try {
    await chrome.storage.session.set({
      [DISPLACED_KEY]: asPlainDisplaced,
      [RESPONSES_KEY]: asPlainResponses
    });
  } catch (err) {
    error('Could not remember what the cookie mocks displaced', err);
  }
}

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
  await primed();

  const forDomain = displaced.get(domain) ?? new Map<ohMyCookieId, Displaced>();
  displaced.set(domain, forDomain);

  // `undefined` means "already recorded, record nothing new" — distinct from
  // `null`, which is a recorded "nothing was there".
  let toRecord: Displaced | undefined;

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
    //
    // The same goes for **parent domains**. `get({url})` also answers with a
    // cookie the site set with `Domain=.example.com`, while the `set` below —
    // a url and no `domain` — writes a host-only cookie: a different cookie,
    // sitting beside it. Chrome reports a domain cookie with the leading dot,
    // which is what tells the two apart. Recording the domain cookie as
    // displaced made unapplying write its old value back as a host-only copy —
    // a stale twin that shadows the site's real cookie after it rotates.
    const displacedByThis = !!existing &&
      CookieUtils.path(existing.path) === CookieUtils.path(cookie.path) &&
      !existing.domain?.startsWith('.');

    // No value comparison. There used to be one — `existing.value !==
    // cookie.value` — to catch "this is the mock itself, applied before the
    // worker was torn down and restarted", because remembering it would make
    // unapplying restore the very mock it was removing.
    //
    // The record survives the teardown now, so that case never reaches here:
    // `forDomain.has(cookie.id)` is already true and nothing is re-recorded.
    // The comparison had become pure harm. A cookie *recorded* from the site
    // stores the site's own current value (`CookieUtils.fromBrowser`), so
    // enabling a recorded mock unchanged — freezing your session, the obvious
    // thing to do with one — made the values equal, recorded "nothing was
    // displaced", and switching it off then deleted the site's real cookie.
    toRecord = displacedByThis ? existing : null;
  }

  // Before the `set`, because `chrome.cookies.onChanged` can fire before the
  // promise resolves; taken back if the write never happened, so the recorder
  // is not blind to the next change that really is the server's.
  const writeKey = ownWriteKey(domain, cookie.name, cookie.path);
  ownWrites.add(writeKey);

  try {
    await chrome.cookies.set(detailsFor(domain, cookie));
  } catch (err) {
    ownWrites.delete(writeKey);
    throw err;
  }

  // Success is recorded only now. It used to be recorded first, and
  // `chrome.cookies.set` can refuse — `SameSite=None` without `Secure`, for
  // one. The mock then read as applied while nothing was in the jar, and a
  // later switch-off "unapplied" a cookie the mock never wrote: with nothing
  // displaced that is a removal, of whatever the site had put there since.
  if (toRecord !== undefined) {
    forDomain.set(cookie.id, toRecord);
  }

  await remember();
}

/**
 * Removes a cookie mock and puts back whatever it displaced.
 *
 * If nothing was displaced the cookie is removed outright; if something was,
 * it is written back with its original flags — including `httpOnly`, which is
 * why this has to run in the background.
 */
export async function unapplyCookie(domain: ohMyDomain, cookie: IOhMyCookie): Promise<void> {
  await primed();

  const forDomain = displaced.get(domain);
  const previous = forDomain?.get(cookie.id);
  const url = cookieUrl(domain, cookie.path, cookie.secure);

  // Only a host-only cookie on the *same* path is ever recorded as displaced
  // (see `applyCookie`), so writing it back here lands on the mock and
  // replaces it.
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

    // Forgotten only once it is back. This used to happen before the write, so
    // a `set` that failed left the original unrecoverable *and* the mock still
    // in the jar — and it can fail: the url is built from the mock's `secure`
    // flag while the details carry the original's, so restoring a `Secure`
    // cookie over a non-secure mock is attempted on `http://`.
    forDomain?.delete(cookie.id);
    await remember();

    return;
  }

  // Not `chrome.cookies.remove({url, name})`, which is *not* the inverse of the
  // `set` in `applyCookie`: Chromium routes it through a deletion filter that
  // matches every cookie of that name the browser would send for the url —
  // `CookiesRemoveFunction` builds a `CookieDeletionFilter{url, name}`, and
  // `CookieDeletionInfo::Matches` answers with `IncludeForRequestURL` under
  // all-inclusive options. The site's `.example.com` twin and its parent-path
  // cookies of the same name would all go with the mock — the logout this
  // module exists to prevent, done by the cleanup itself. Overwriting the same
  // host-only cookie with an expiry in the past is the browser's own precise
  // delete: it touches exactly one cookie, the one the jar wrote. The change
  // arrives at the recorder as `removed: true`, which it ignores, so no
  // own-write entry is needed.
  await chrome.cookies.set({
    url,
    name: cookie.name,
    value: '',
    path: CookieUtils.path(cookie.path),
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? false,
    expirationDate: 1
  });
  forDomain?.delete(cookie.id);
  await remember();
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
    // A mock whose expiry has already passed cannot be applied — `set` with a
    // past `expirationDate` is a *delete*, so "applying" it would remove the
    // site's real cookie while the mock reads as switched on. It is treated
    // like a disabled mock instead, loudly.
    const expired = cookie.expirationDate !== undefined &&
      cookie.expirationDate <= Date.now() / 1000;

    const wanted = domainIsActive && cookie.enabled[preset];

    try {
      if (wanted && !expired) {
        await applyCookie(domain, cookie);
      } else {
        if (wanted) {
          error(`Cookie mock ${cookie.name} for ${domain} has expired, so it is not applied`);
        }

        if (isApplied(domain, cookie.id)) {
          await unapplyCookie(domain, cookie);
        }
      }
    } catch (err) {
      // One mock the browser refuses — an unstorable flag combination, say —
      // must not keep the rest of the domain's cookies from syncing.
      error(`Could not sync cookie mock ${cookie.name} for ${domain}`, err);
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
 * Reads back what earlier lives of this worker recorded — both maps.
 *
 * Called from `primeCookieSync` at startup; `primed()` does the same work
 * lazily for whichever mutator gets there first.
 */
export async function primeResponseCookies(): Promise<void> {
  await primed();
}

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
  return serialiseCookieWork(domain, async () => {
    // The switch is consulted here, at the moment of writing, because nothing
    // upstream does: switching mocking off runs `unapplyResponseCookies` once,
    // and a response already in flight lands *after* it. Its cookies would
    // re-fabricate the session with mocking off — and nothing ever takes them
    // back out, since the state does not change again and no sync re-runs.
    // Read from storage rather than from the sync's cache: a fresh worker
    // woken by this very message has an empty cache, and answering "inactive"
    // from it would silently drop the cookies of every first response.
    const state = await StorageUtils.get<IState>(domain);

    if (!CookieUtils.isMockingActive(state)) {
      return;
    }

    await primed();

    const applied = fromResponses.get(domain) ?? new Map<ohMyCookieId, IOhMyCookie>();
    fromResponses.set(domain, applied);

    for (const cookie of cookies) {
      const asMock = asCookieMock(cookie);

      try {
        await applyCookie(domain, asMock);
        // Remembered only once it is in the jar — an entry for a write the
        // browser refused would make the eventual unapply remove a cookie this
        // extension never wrote.
        applied.set(asMock.id, asMock);
      } catch (err) {
        error(`Could not set response cookie ${cookie.name} for ${domain}`, err);
      }
    }

    await remember();
  });
}

/**
 * Takes back every cookie a response set on this domain.
 *
 * Switching mocking off has to undo these as well as the standalone mocks, or a
 * fabricated session outlives the mocking that fabricated it — which is the
 * failure the whole displace-and-restore dance exists to prevent.
 */
export async function unapplyResponseCookies(domain: ohMyDomain): Promise<void> {
  await primed();

  const applied = fromResponses.get(domain);

  if (!applied) {
    return;
  }

  fromResponses.delete(domain);

  for (const cookie of applied.values()) {
    // `isApplied` reads the in-memory `displaced` map, which a teardown *does*
    // clear. After a restart the cookie is in the jar but not in that map, so
    // asking would answer no and it would never be removed — which is the whole
    // reason this list is remembered. Unapply unconditionally: it removes what
    // it cannot restore, which is the right outcome for a cookie this extension
    // wrote.
    await unapplyCookie(domain, cookie);
  }

  await remember();
}

/** Test seam: drops the remembered originals for a domain. */
export function forgetDisplaced(domain?: ohMyDomain): void {
  ownWrites.clear();
  // A real teardown re-evaluates the module, so the read-back has not happened
  // yet in the new worker. Clearing this is what makes this seam stand in for
  // one rather than merely emptying the maps.
  priming = undefined;
  domainQueues.clear();

  if (domain) {
    displaced.delete(domain);
    fromResponses.delete(domain);

    return;
  }

  displaced.clear();
  fromResponses.clear();
}
