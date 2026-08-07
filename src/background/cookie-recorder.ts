/// <reference types="chrome"/>

import { IState, ohMyCookieId, ohMyDomain } from '../shared/type';
import { CookieUtils } from '../shared/utils/cookie';
import { OhMyQueue } from '../shared/utils/queue';
import { StorageUtils } from '../shared/utils/storage';
import { consumeOwnWrite } from './cookie-jar';
import { activeDomains, syncedCookies } from './cookie-sync';
import { OhMyCookieHandler } from './handlers/cookie-handler';
import { error } from './utils';
import { notWhileWiping } from './wipe-barrier';

/**
 * Records the cookies a real (passthrough) response sets, so they do not have
 * to be typed in by hand.
 *
 * ## Why not `declarativeNetRequest`
 *
 * `remove-csp-header.ts` rewrites response headers with a DNR rule, and the
 * design notes assumed `Set-Cookie` could be read the same way. It cannot: DNR
 * is declarative in both directions — a rule states what to do with a header
 * without ever seeing its value, and no event hands the extension the matched
 * response. `onRuleMatchedDebug` reports *that* a rule matched (and only for
 * unpacked extensions), never the headers. So DNR can strip or overwrite a
 * `Set-Cookie`, but it can never tell us what one said.
 *
 * The alternative that does hand over raw headers is `webRequest`, in MV3 only
 * in observational mode, and it needs the `webRequest` permission plus
 * `extraHeaders` before `Set-Cookie` is even visible.
 *
 * `chrome.cookies.onChanged` needs neither. It fires once the browser has
 * accepted the cookie, with everything a mock stores — value, path, `httpOnly`,
 * `secure`, `sameSite`, expiry — already parsed, and the `cookies` permission
 * the jar needs anyway is the only one required. What it cannot say is *which*
 * response set the cookie, and it does not distinguish a `Set-Cookie` from a
 * `document.cookie` write. For filling in a mock neither matters.
 *
 * Recording only ever adds a mock, switched off in every preset, and never
 * touches one that already exists — what is recorded is a starting point for
 * the user, never a change to what they set up.
 */
export class OhMyCookieRecorder {
  static StorageUtils = StorageUtils;
  static CookieHandler = OhMyCookieHandler;

  /**
   * What has been recorded, keyed by domain, name and path.
   *
   * Two jobs. The state's own list lags a storage round trip behind, so a
   * server setting the same cookie twice would otherwise be recorded twice.
   * And a mock the user deletes stays in here, so it does not come straight
   * back the next time the server sets it.
   *
   * That second job needs it to outlive the service worker, which MV3 tears
   * down after ~30s of idle — as an in-memory set it lasted minutes, and a
   * deleted cookie mock reappeared as soon as the worker had been away and the
   * server set the cookie again. `chrome.storage.session` keeps it for as long
   * as the browser is open, which is the right lifetime: "deleted" is a
   * decision about this browsing session, not for ever.
   */
  private static recorded = new Set<string>();
  private static readonly SESSION_KEY = 'OhMyRecordedCookies';
  private static priming?: Promise<void>;

  /**
   * Reads back what earlier lives of this worker had already recorded.
   *
   * One shared promise, not a boolean. A flag flipped before the awaited read
   * completed let a second `onChanged` arriving *during* the read walk straight
   * through against a still-empty set — re-recording a mock the user had
   * deleted, and then `remember()` snapshotted that near-empty set over the
   * session key, wiping the very decisions the read was fetching. Every caller
   * now waits on the same read, however many arrive while it runs.
   */
  static prime(): Promise<void> {
    OhMyCookieRecorder.priming ??= (async () => {
      try {
        const stored = await chrome.storage.session.get(OhMyCookieRecorder.SESSION_KEY);

        for (const key of (stored?.[OhMyCookieRecorder.SESSION_KEY] ?? []) as string[]) {
          OhMyCookieRecorder.recorded.add(key);
        }
      } catch (err) {
        error('Could not read back which cookies were already recorded', err);
      }
    })();

    return OhMyCookieRecorder.priming;
  }

  private static async remember(): Promise<void> {
    try {
      await chrome.storage.session.set({
        [OhMyCookieRecorder.SESSION_KEY]: [...OhMyCookieRecorder.recorded]
      });
    } catch (err) {
      error('Could not remember which cookies were recorded', err);
    }
  }

  static async onChanged({ cookie, removed }: chrome.cookies.CookieChangeInfo): Promise<ohMyCookieId | undefined> {
    if (removed) { // Only what a server sets is worth recording
      return undefined;
    }

    // The set is per browser session, not per worker life — see `recorded`.
    await OhMyCookieRecorder.prime();

    const domain = activeDomains().find(d => CookieUtils.appliesTo(d, cookie.domain));

    if (!domain) { // Not a domain mocking is switched on for
      return undefined;
    }

    if (consumeOwnWrite(domain, cookie.name, cookie.path)) { // The jar's own mock
      return undefined;
    }

    const key = `${domain}|${cookie.name}|${cookie.path}`;

    if (OhMyCookieRecorder.recorded.has(key) ||
      CookieUtils.find(syncedCookies(domain), { name: cookie.name, path: cookie.path })) {
      return undefined;
    }

    OhMyCookieRecorder.recorded.add(key);
    await OhMyCookieRecorder.remember();

    try {
      return await OhMyCookieRecorder.record(domain, cookie);
    } catch (err) {
      OhMyCookieRecorder.recorded.delete(key);
      await OhMyCookieRecorder.remember();
      error(`Could not record cookie ${cookie.name}`, err);

      return undefined;
    }
  }

  private static async record(
    domain: ohMyDomain, cookie: chrome.cookies.Cookie
  ): Promise<ohMyCookieId | undefined> {
    const state = await OhMyCookieRecorder.StorageUtils.get<IState>(domain);

    if (!state) {
      return undefined;
    }

    // `enabled` is left empty on purpose: a recorded cookie is off in every
    // preset, so recording never changes what the browser does.
    const recorded = await OhMyCookieRecorder.CookieHandler.upsert(state, {
      ...CookieUtils.fromBrowser(cookie),
      enabled: {}
    });

    return recorded.id;
  }

  /** Test seam. */
  static forget(): void {
    OhMyCookieRecorder.recorded.clear();
    // A real teardown re-evaluates the module, so the read-back has not
    // happened yet in the new worker — same reasoning as the jar's seam.
    OhMyCookieRecorder.priming = undefined;
  }
}

export function initCookieRecorder(queue: OhMyQueue): void {
  OhMyCookieHandler.queue = queue;

  chrome.cookies.onChanged.addListener((changeInfo: chrome.cookies.CookieChangeInfo) => {
    // Through the wipe barrier. This is the one writer that reaches storage
    // without a packet ever passing through the message queue — it writes a
    // cookie record and then queues the state patch that lists it — so a full
    // reset running beside it would clear storage between those two writes and
    // leave a cookie mock, or a state naming one, that the rebuilt store never
    // lists. See `wipe-barrier.ts`.
    //
    // The promise was dropped. `onChanged`'s own `try` wraps only the record
    // itself, so anything thrown before it — `activeDomains()`,
    // `CookieUtils.appliesTo` — became an unhandled rejection in the service
    // worker rather than a line in the log.
    void notWhileWiping(() => OhMyCookieRecorder.onChanged(changeInfo)).catch(err => {
      error('Failed while recording a cookie the server set', err);
    });
  });
}
