/// <reference types="chrome"/>

import { IState, ohMyCookieId, ohMyDomain } from '../shared/type';
import { CookieUtils } from '../shared/utils/cookie';
import { OhMyQueue } from '../shared/utils/queue';
import { StorageUtils } from '../shared/utils/storage';
import { consumeOwnWrite } from './cookie-jar';
import { activeDomains, syncedCookies } from './cookie-sync';
import { OhMyCookieHandler } from './handlers/cookie-handler';
import { error } from './utils';

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
   * What has been recorded in this worker's life, keyed by domain, name and
   * path. The state's own list lags a storage round trip behind, so a server
   * setting the same cookie twice would otherwise be recorded twice. A mock the
   * user deletes stays in here until the worker restarts, which is the
   * behaviour to want: a deleted mock should not come straight back.
   */
  private static recorded = new Set<string>();

  static async onChanged({ cookie, removed }: chrome.cookies.CookieChangeInfo): Promise<ohMyCookieId | undefined> {
    if (removed) { // Only what a server sets is worth recording
      return undefined;
    }

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

    try {
      return await OhMyCookieRecorder.record(domain, cookie);
    } catch (err) {
      OhMyCookieRecorder.recorded.delete(key);
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
  }
}

export function initCookieRecorder(queue: OhMyQueue): void {
  OhMyCookieHandler.queue = queue;

  chrome.cookies.onChanged.addListener((changeInfo: chrome.cookies.CookieChangeInfo) => {
    OhMyCookieRecorder.onChanged(changeInfo);
  });
}
