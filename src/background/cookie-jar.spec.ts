import { objectTypes } from '../shared/constants';
import { IOhMyCookie } from '../shared/type';
import {
  applyCookie, consumeOwnWrite, cookieUrl, forgetDisplaced, isApplied, syncCookies, unapplyCookie
} from './cookie-jar';

function mock(over: Partial<IOhMyCookie> = {}): IOhMyCookie {
  return {
    id: 'c1',
    version: '1.0.0',
    type: objectTypes.COOKIE,
    name: 'session',
    value: 'mocked',
    enabled: { default: true },
    ...over
  };
}

describe('cookie-jar', () => {
  /**
   * A stand-in for the browser's cookie jar, keyed by **name and path**.
   *
   * It used to be keyed by name alone, which could not represent two cookies of
   * the same name on different paths — so the tests could not see the case
   * where that difference matters, and a real bug lived in `applyCookie` for as
   * long as this harness did. The two path rules below are the ones the real
   * API follows and the ones the jar depends on:
   *
   *  - `get` matches a cookie on the request path **or any parent of it**,
   *    preferring the longest match.
   *  - `set` and `remove` are exact: they only ever touch the given path.
   */
  let jar: Map<string, chrome.cookies.Cookie>;

  const key = (name: string, path: string) => `${name}|${path}`;
  const pathOf = (url: string) => new URL(url).pathname || '/';

  /** What is in the jar for a name and path, or `undefined`. */
  const at = (name: string, path = '/') => jar.get(key(name, path));

  /** Seeds the jar the way a server would. */
  const seed = (cookie: Partial<chrome.cookies.Cookie> & { name: string }) => {
    const full = { path: '/', value: '', ...cookie } as chrome.cookies.Cookie;
    jar.set(key(full.name, full.path), full);
  };

  beforeEach(() => {
    jar = new Map();
    forgetDisplaced();

    // `src/test.ts` defines `chrome` non-configurably, so only the slice under
    // test is replaced rather than the whole namespace.
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.cookies = {
      get: jest.fn(async ({ url, name }: { url: string, name: string }) => {
        const wanted = pathOf(url);
        const candidates = [...jar.values()].filter(c =>
          c.name === name &&
          (wanted === c.path || wanted.startsWith(c.path.replace(/\/$/, '') + '/')));

        // The browser hands back the most specific match.
        return candidates.sort((a, b) => b.path.length - a.path.length)[0] ?? null;
      }),
      set: jest.fn(async (details: chrome.cookies.SetDetails) => {
        const stored = { path: '/', ...details } as unknown as chrome.cookies.Cookie;
        jar.set(key(stored.name, stored.path), stored);
        return stored;
      }),
      remove: jest.fn(async ({ url, name }: { url: string, name: string }) => {
        jar.delete(key(name, pathOf(url)));
        return null;
      })
    };
  });

  describe('#cookieUrl', () => {
    it('uses http for localhost and https elsewhere', () => {
      expect(cookieUrl('localhost:8090')).toBe('http://localhost:8090/');
      expect(cookieUrl('api.example.com')).toBe('https://api.example.com/');
    });

    it('honours a secure cookie even on localhost', () => {
      expect(cookieUrl('localhost:8090', '/', true)).toBe('https://localhost:8090/');
    });

    it('normalises a path without a leading slash', () => {
      expect(cookieUrl('example.com', 'admin')).toBe('https://example.com/admin');
    });
  });

  describe('#applyCookie', () => {
    it('writes the mock, httpOnly included', async () => {
      await applyCookie('example.com', mock({ httpOnly: true }));

      expect(at('session')).toEqual(expect.objectContaining({
        name: 'session', value: 'mocked', httpOnly: true, path: '/'
      }));
    });

    it('makes the path absolute, which `chrome.cookies.set` insists on', async () => {
      await applyCookie('example.com', mock({ path: 'admin' }));

      expect(at('session', '/admin')?.path).toBe('/admin');
    });

    // A restarted service worker forgets what it displaced but the browser
    // still holds the mock it set. Remembering that as "the original" would
    // make unapplying restore the mock it is trying to remove.
    it('does not mistake its own earlier write for the original', async () => {
      seed({ name: 'session', value: 'mocked' });

      await applyCookie('example.com', mock());
      await unapplyCookie('example.com', mock());

      expect(at('session')).toBeUndefined();
    });

    // `chrome.cookies.get` matches parent paths but `set` does not, so a mock
    // on `/admin` finds the site's `/` cookie yet writes a *second* cookie
    // beside it. Recording that parent as "displaced" made unapply take the
    // restore branch: it rewrote the untouched `/` cookie and left the mock at
    // `/admin` in place — so the mock survived every way of switching it off.
    it('does not treat a parent-path cookie as the one it displaced', async () => {
      seed({ name: 'session', value: 'real-root', path: '/' });

      await applyCookie('example.com', mock({ path: '/admin' }));

      expect(at('session', '/admin')?.value).toBe('mocked');
      expect(at('session')?.value).toBe('real-root');

      await unapplyCookie('example.com', mock({ path: '/admin' }));

      // The mock is gone and the site's own cookie was never touched.
      expect(at('session', '/admin')).toBeUndefined();
      expect(at('session')?.value).toBe('real-root');
    });

    // Applying twice must not record the mock's own value as "what was there
    // before", or the original can never be restored.
    it('remembers the original only once', async () => {
      seed({ name: 'session', value: 'real' });

      await applyCookie('example.com', mock());
      await applyCookie('example.com', mock({ value: 'changed' }));
      await unapplyCookie('example.com', mock());

      expect(at('session')?.value).toBe('real');
    });
  });

  describe('#unapplyCookie', () => {
    // The one that matters: deleting instead of restoring would log the
    // developer out of the site they were testing.
    it('restores the cookie the mock displaced', async () => {
      seed({
        name: 'session', value: 'real-session', httpOnly: true, path: '/'
      });

      await applyCookie('example.com', mock());
      expect(at('session')?.value).toBe('mocked');

      await unapplyCookie('example.com', mock());

      expect(at('session')).toEqual(expect.objectContaining({
        value: 'real-session', httpOnly: true
      }));
    });

    it('removes the cookie when it displaced nothing', async () => {
      await applyCookie('example.com', mock());
      await unapplyCookie('example.com', mock());

      expect(at('session')).toBeUndefined();
    });

    // A torn-down service worker loses what it remembered; removing is the
    // safe answer, inventing a previous value is not.
    it('removes rather than guesses when it remembers nothing', async () => {
      seed({ name: 'session', value: 'real' });

      await unapplyCookie('example.com', mock());

      expect(at('session')).toBeUndefined();
    });
  });

  describe('#syncCookies', () => {
    it('applies enabled mocks and unapplies the rest', async () => {
      const on = mock({ id: 'a', name: 'on', enabled: { default: true } });
      const off = mock({ id: 'b', name: 'off', enabled: { default: false } });

      await syncCookies('example.com', [on, off], 'default', true);

      expect(at('on')?.value).toBe('mocked');
      expect(at('off')).toBeUndefined();
    });

    it('unapplies everything once the domain is inactive', async () => {
      const cookie = mock();

      await syncCookies('example.com', [cookie], 'default', true);
      expect(at('session')).toBeDefined();

      await syncCookies('example.com', [cookie], 'default', false);
      expect(at('session')).toBeUndefined();
    });

    // Switching off a mock that was never on must not take the site's real
    // cookie of the same name with it.
    it('leaves alone a cookie it never applied', async () => {
      seed({ name: 'session', value: 'real' });

      await syncCookies('example.com', [mock({ enabled: { default: false } })], 'default', true);

      expect(at('session')?.value).toBe('real');
    });

    it('follows the preset, so a scenario can mean "logged out"', async () => {
      const cookie = mock({ enabled: { default: true, 'logged-out': false } });

      await syncCookies('example.com', [cookie], 'default', true);
      expect(at('session')).toBeDefined();

      await syncCookies('example.com', [cookie], 'logged-out', true);
      expect(at('session')).toBeUndefined();
    });
  });

  describe('#isApplied', () => {
    it('knows what this worker put in the jar', async () => {
      expect(isApplied('example.com', 'c1')).toBe(false);

      await applyCookie('example.com', mock());
      expect(isApplied('example.com', 'c1')).toBe(true);

      await unapplyCookie('example.com', mock());
      expect(isApplied('example.com', 'c1')).toBe(false);
    });
  });

  // The recorder listens to `chrome.cookies.onChanged` and would otherwise
  // offer the extension's own mocks back as cookies to record.
  describe('#consumeOwnWrite', () => {
    it('reports a write the jar made, once', async () => {
      await applyCookie('example.com', mock({ path: 'admin' }));

      expect(consumeOwnWrite('example.com', 'session', '/admin')).toBe(true);
      expect(consumeOwnWrite('example.com', 'session', '/admin')).toBe(false);
    });

    it('reports nothing for a cookie the jar did not write', () => {
      expect(consumeOwnWrite('example.com', 'session')).toBe(false);
    });

    it('reports the write that restores the displaced cookie', async () => {
      seed({ name: 'session', value: 'real', path: '/' });

      await applyCookie('example.com', mock());
      consumeOwnWrite('example.com', 'session');

      await unapplyCookie('example.com', mock());

      expect(consumeOwnWrite('example.com', 'session')).toBe(true);
    });
  });
});
