import { objectTypes } from '../constants';
import { IOhMyCookie } from '../type';
import { CookieUtils } from './cookie';

function browserCookie(over: Partial<chrome.cookies.Cookie> = {}): chrome.cookies.Cookie {
  return {
    domain: 'example.com',
    name: 'session',
    value: 'abc',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    session: true,
    hostOnly: true,
    storeId: '0',
    ...over
  };
}

describe('Utils/Cookie', () => {
  describe('#init', () => {
    it('creates a cookie mock with an id and a type', () => {
      const cookie = CookieUtils.init({ name: 'session', value: 'abc' });

      expect(cookie.id).toEqual(expect.any(String));
      expect(cookie.type).toBe(objectTypes.COOKIE);
      expect(cookie.enabled).toEqual({});
    });

    // `{ ...{ enabled: undefined } }` overwrites, so an update that only
    // changes the value would otherwise switch the mock off everywhere.
    it('keeps the presets an update does not mention', () => {
      const base = CookieUtils.init({ name: 'session', enabled: { default: true } });
      const updated = CookieUtils.init(base, { value: 'other' });

      expect(updated.enabled).toEqual({ default: true });
      expect(updated.value).toBe('other');
      expect(updated.id).toBe(base.id);
    });

    it('merges presets from the update', () => {
      const base = CookieUtils.init({ enabled: { default: true } });
      const updated = CookieUtils.init(base, { enabled: { default: false, other: true } });

      expect(updated.enabled).toEqual({ default: false, other: true });
    });
  });

  describe('#path', () => {
    it('defaults to the root and makes the path absolute', () => {
      expect(CookieUtils.path()).toBe('/');
      expect(CookieUtils.path('')).toBe('/');
      expect(CookieUtils.path('admin')).toBe('/admin');
      expect(CookieUtils.path('/admin')).toBe('/admin');
    });
  });

  describe('#isSame', () => {
    it('identifies a cookie by name and path', () => {
      expect(CookieUtils.isSame({ name: 'a' }, { name: 'a', path: '/' })).toBe(true);
      expect(CookieUtils.isSame({ name: 'a', path: '/x' }, { name: 'a' })).toBe(false);
      expect(CookieUtils.isSame({ name: 'a' }, { name: 'b' })).toBe(false);
    });
  });

  describe('#find', () => {
    const cookies: IOhMyCookie[] = [
      CookieUtils.init({ id: '1', name: 'a' }),
      CookieUtils.init({ id: '2', name: 'b', path: '/admin' })
    ];

    it('finds by id', () => {
      expect(CookieUtils.find(cookies, { id: '2' })?.name).toBe('b');
    });

    it('finds by name and path', () => {
      expect(CookieUtils.find(cookies, { name: 'b', path: '/admin' })?.id).toBe('2');
      expect(CookieUtils.find(cookies, { name: 'b' })).toBeUndefined();
    });
  });

  describe('#fromBrowser', () => {
    it('keeps httpOnly rather than dropping it', () => {
      expect(CookieUtils.fromBrowser(browserCookie())).toEqual({
        name: 'session', value: 'abc', path: '/', httpOnly: true, secure: true, sameSite: 'lax'
      });
    });

    // 'unspecified' is the absence of the attribute; storing it would make
    // the mock claim something the server never said.
    it('drops an unspecified sameSite', () => {
      const result = CookieUtils.fromBrowser(browserCookie({ sameSite: 'unspecified' }));

      expect(result.sameSite).toBeUndefined();
      expect('sameSite' in result).toBe(false);
    });

    it('keeps an expiry, and stays a session cookie without one', () => {
      expect(CookieUtils.fromBrowser(browserCookie({ expirationDate: 123 })).expirationDate).toBe(123);
      expect('expirationDate' in CookieUtils.fromBrowser(browserCookie())).toBe(false);
    });
  });

  describe('#appliesTo', () => {
    // A state's domain is `window.location.host` and carries the port; a
    // cookie's domain never does.
    it('ignores the port of the state domain', () => {
      expect(CookieUtils.appliesTo('localhost:8090', 'localhost')).toBe(true);
    });

    it('matches a cookie set for the parent domain', () => {
      expect(CookieUtils.appliesTo('api.example.com', '.example.com')).toBe(true);
      expect(CookieUtils.appliesTo('example.com', 'example.com')).toBe(true);
    });

    it('does not match a different domain', () => {
      expect(CookieUtils.appliesTo('example.com', 'api.example.com')).toBe(false);
      expect(CookieUtils.appliesTo('notexample.com', 'example.com')).toBe(false);
      expect(CookieUtils.appliesTo('example.com', 'other.com')).toBe(false);
    });
  });
});
