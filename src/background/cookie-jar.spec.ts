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
  let jar: Record<string, chrome.cookies.Cookie>;

  beforeEach(() => {
    jar = {};
    forgetDisplaced();

    // `src/test.ts` defines `chrome` non-configurably, so only the slice under
    // test is replaced rather than the whole namespace.
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.cookies = {
      get: jest.fn(async ({ name }: { name: string }) => jar[name] ?? null),
      set: jest.fn(async (details: chrome.cookies.SetDetails) => {
        jar[details.name as string] = details as unknown as chrome.cookies.Cookie;
        return jar[details.name as string];
      }),
      remove: jest.fn(async ({ name }: { name: string }) => {
        delete jar[name];
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

      expect(jar['session']).toEqual(expect.objectContaining({
        name: 'session', value: 'mocked', httpOnly: true, path: '/'
      }));
    });

    it('makes the path absolute, which `chrome.cookies.set` insists on', async () => {
      await applyCookie('example.com', mock({ path: 'admin' }));

      expect(jar['session'].path).toBe('/admin');
    });

    // A restarted service worker forgets what it displaced but the browser
    // still holds the mock it set. Remembering that as "the original" would
    // make unapplying restore the mock it is trying to remove.
    it('does not mistake its own earlier write for the original', async () => {
      jar['session'] = { name: 'session', value: 'mocked' } as chrome.cookies.Cookie;

      await applyCookie('example.com', mock());
      await unapplyCookie('example.com', mock());

      expect(jar['session']).toBeUndefined();
    });

    // Applying twice must not record the mock's own value as "what was there
    // before", or the original can never be restored.
    it('remembers the original only once', async () => {
      jar['session'] = { name: 'session', value: 'real' } as chrome.cookies.Cookie;

      await applyCookie('example.com', mock());
      await applyCookie('example.com', mock({ value: 'changed' }));
      await unapplyCookie('example.com', mock());

      expect(jar['session'].value).toBe('real');
    });
  });

  describe('#unapplyCookie', () => {
    // The one that matters: deleting instead of restoring would log the
    // developer out of the site they were testing.
    it('restores the cookie the mock displaced', async () => {
      jar['session'] = {
        name: 'session', value: 'real-session', httpOnly: true, path: '/'
      } as chrome.cookies.Cookie;

      await applyCookie('example.com', mock());
      expect(jar['session'].value).toBe('mocked');

      await unapplyCookie('example.com', mock());

      expect(jar['session']).toEqual(expect.objectContaining({
        value: 'real-session', httpOnly: true
      }));
    });

    it('removes the cookie when it displaced nothing', async () => {
      await applyCookie('example.com', mock());
      await unapplyCookie('example.com', mock());

      expect(jar['session']).toBeUndefined();
    });

    // A torn-down service worker loses what it remembered; removing is the
    // safe answer, inventing a previous value is not.
    it('removes rather than guesses when it remembers nothing', async () => {
      jar['session'] = { name: 'session', value: 'real' } as chrome.cookies.Cookie;

      await unapplyCookie('example.com', mock());

      expect(jar['session']).toBeUndefined();
    });
  });

  describe('#syncCookies', () => {
    it('applies enabled mocks and unapplies the rest', async () => {
      const on = mock({ id: 'a', name: 'on', enabled: { default: true } });
      const off = mock({ id: 'b', name: 'off', enabled: { default: false } });

      await syncCookies('example.com', [on, off], 'default', true);

      expect(jar['on'].value).toBe('mocked');
      expect(jar['off']).toBeUndefined();
    });

    it('unapplies everything once the domain is inactive', async () => {
      const cookie = mock();

      await syncCookies('example.com', [cookie], 'default', true);
      expect(jar['session']).toBeDefined();

      await syncCookies('example.com', [cookie], 'default', false);
      expect(jar['session']).toBeUndefined();
    });

    // Switching off a mock that was never on must not take the site's real
    // cookie of the same name with it.
    it('leaves alone a cookie it never applied', async () => {
      jar['session'] = { name: 'session', value: 'real' } as chrome.cookies.Cookie;

      await syncCookies('example.com', [mock({ enabled: { default: false } })], 'default', true);

      expect(jar['session'].value).toBe('real');
    });

    it('follows the preset, so a scenario can mean "logged out"', async () => {
      const cookie = mock({ enabled: { default: true, 'logged-out': false } });

      await syncCookies('example.com', [cookie], 'default', true);
      expect(jar['session']).toBeDefined();

      await syncCookies('example.com', [cookie], 'logged-out', true);
      expect(jar['session']).toBeUndefined();
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
      jar['session'] = { name: 'session', value: 'real', path: '/' } as chrome.cookies.Cookie;

      await applyCookie('example.com', mock());
      consumeOwnWrite('example.com', 'session');

      await unapplyCookie('example.com', mock());

      expect(consumeOwnWrite('example.com', 'session')).toBe(true);
    });
  });
});
