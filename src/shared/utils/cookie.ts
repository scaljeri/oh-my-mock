/// <reference types="chrome"/>

import { objectTypes } from '../constants';
import { IOhMyCookie, IState, ohMyDomain } from '../type';
import { timestamp } from './timestamp';
import { uniqueId } from './unique-id';

/**
 * What a `payloadType.COOKIE` message carries.
 *
 * It lives here rather than in `packet-type.ts` so that everything about cookie
 * mocks stays in one place; the handler is `background/handlers/cookie-handler`.
 */
export interface IOhMyCookieUpdate {
  cookie: Partial<IOhMyCookie>;
  /** Deletes the mock (by id) instead of upserting it. */
  remove?: boolean;
}

/**
 * Creating and comparing cookie mocks.
 *
 * A cookie mock is its own record, keyed by id like a response, and referenced
 * from `IState.cookies`. See `docs/architecture/cookie-mocking.md`.
 */
export class CookieUtils {
  static version = '__OH_MY_VERSION__';

  static init(base: Partial<IOhMyCookie> = {}, update: Partial<IOhMyCookie> = {}): IOhMyCookie {
    return {
      version: CookieUtils.version,
      id: uniqueId(),
      createdOn: timestamp(),
      name: '',
      value: '',
      ...base,
      ...update,
      // Spread last: `{ ...{ enabled: undefined } }` overwrites, so a `base` or
      // `update` that merely omits the field would wipe the presets.
      enabled: { ...base.enabled, ...update.enabled },
      type: objectTypes.COOKIE
    };
  }

  static isCookie(input: unknown): input is IOhMyCookie {
    return (input as IOhMyCookie)?.type === objectTypes.COOKIE;
  }

  /** A cookie is identified by its name and path, the way the browser does. */
  static isSame(a: Partial<IOhMyCookie>, b: Partial<IOhMyCookie>): boolean {
    return a.name === b.name && CookieUtils.path(a.path) === CookieUtils.path(b.path);
  }

  static find(cookies: IOhMyCookie[], search: Partial<IOhMyCookie>): IOhMyCookie | undefined {
    return cookies.find(c => search.id ? c.id === search.id : CookieUtils.isSame(c, search));
  }

  /**
   * `chrome.cookies.set` rejects a path that is not absolute, so a mock written
   * as `admin` has to become `/admin` before it reaches the API.
   */
  static path(path?: string): string {
    if (!path) {
      return '/';
    }

    return path.startsWith('/') ? path : `/${path}`;
  }

  /** What a real cookie looks like as a mock — used when recording. */
  static fromBrowser(cookie: chrome.cookies.Cookie): Partial<IOhMyCookie> {
    return {
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      // 'unspecified' is the absence of the attribute, not a value to store.
      ...(cookie.sameSite && cookie.sameSite !== 'unspecified' && { sameSite: cookie.sameSite }),
      ...(cookie.expirationDate !== undefined && { expirationDate: cookie.expirationDate })
    };
  }

  /**
   * Whether cookies should be in the jar for this state at all.
   *
   * The domain's own switch, nothing else — deliberately not the popup, which
   * response mocking additionally needs (it hosts nothing a cookie uses, and
   * dropping a mocked session whenever the window closes would be a surprise).
   * One rule with two readers: `cookie-sync` decides when to apply and remove,
   * and the jar consults it again before writing a served response's cookies,
   * because a response in flight can land after the switch went off.
   */
  static isMockingActive(state?: IState): boolean {
    return state?.aux?.appActive === true;
  }

  /**
   * Whether a cookie the browser reports belongs to a domain the extension
   * knows about.
   *
   * The two are written differently: a state's domain is `window.location.host`
   * and so carries the port (`localhost:8090`), while a cookie's domain never
   * does and may be a parent domain with a leading dot (`.example.com`) when it
   * was set for the subdomains too.
   */
  static appliesTo(domain: ohMyDomain, cookieDomain: string): boolean {
    const host = domain.split(':')[0];
    const scope = cookieDomain.replace(/^\./, '');

    return !!host && !!scope && (host === scope || host.endsWith(`.${scope}`));
  }
}
