import { objectTypes } from '../shared/constants';
import { IState } from '../shared/type';
import { IOhMyCookie } from '../shared/types/cookie';
import { StorageUtils } from '../shared/utils/storage';
import {
  applyCookie, applyResponseCookies, consumeOwnWrite, cookieUrl, forgetDisplaced, isApplied,
  syncCookies, unapplyCookie, unapplyResponseCookies
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
   * A stand-in for the browser's cookie jar, keyed by **name, domain and
   * path** — the browser's own cookie key.
   *
   * It used to be keyed by name alone, which could not represent two cookies of
   * the same name on different paths or domains — so the tests could not see
   * the cases where that difference matters, and real bugs lived in
   * `applyCookie` for as long as this harness did. The rules below are the ones
   * the real API follows and the ones the jar depends on:
   *
   *  - `get` matches a cookie the browser would *send* for the url: the exact
   *    host for a host-only cookie, the host or any subdomain of it for a
   *    `Domain=.example.com` cookie (kept with its leading dot, as Chrome
   *    reports it), and the request path or any parent of it — preferring the
   *    longest path.
   *  - `set` is exact: a url and no `domain` writes a host-only cookie at the
   *    given path, touching nothing else. A past `expirationDate` is Chrome's
   *    delete-by-overwrite: the equivalent cookie goes, nothing is stored. And
   *    `SameSite=None` without `Secure` is refused, as Chrome refuses it.
   *  - `remove` has the same blast radius as `get`, not as `set`: Chromium
   *    implements it as a deletion filter matched with `IncludeForRequestURL`
   *    (`CookiesRemoveFunction` → `CookieDeletionInfo::Matches`), so it deletes
   *    *every* cookie of that name the browser would send for the url — parent
   *    paths and parent domains included. The jar must never call it near a
   *    cookie it does not own.
   */
  let jar: Map<string, chrome.cookies.Cookie>;
  /** Stands in for `chrome.storage.session`, which outlives the worker. */
  let session: Record<string, unknown>;

  const key = (name: string, domain: string, path: string) => `${name}|${domain}|${path}`;
  const pathOf = (url: string) => new URL(url).pathname || '/';
  const hostOf = (url: string) => new URL(url).hostname;

  /** Whether the browser would send this cookie for a request to `url`. */
  const sentFor = (cookie: chrome.cookies.Cookie, url: string) => {
    const host = hostOf(url);
    const wanted = pathOf(url);
    const domainMatch = cookie.domain.startsWith('.')
      ? host === cookie.domain.slice(1) || host.endsWith(cookie.domain)
      : host === cookie.domain;

    return domainMatch &&
      (wanted === cookie.path || wanted.startsWith(cookie.path.replace(/\/$/, '') + '/'));
  };

  /** What is in the jar for a name, path and domain, or `undefined`. */
  const at = (name: string, path = '/', domain = 'example.com') =>
    jar.get(key(name, domain, path));

  /** Seeds the jar the way a server would; a leading dot means a domain cookie. */
  const seed = (cookie: Partial<chrome.cookies.Cookie> & { name: string }) => {
    const full = { path: '/', value: '', domain: 'example.com', ...cookie } as chrome.cookies.Cookie;
    full.hostOnly = !full.domain.startsWith('.');
    jar.set(key(full.name, full.domain, full.path), full);
  };

  beforeEach(() => {
    jar = new Map();
    session = {};
    forgetDisplaced();

    // Session storage really does survive a worker teardown, so the stub has to
    // as well — `src/test.ts`'s global one answers `{}` and forgets, which
    // would make every mirror test pass for the wrong reason.
    (globalThis as unknown as { chrome: { storage: Record<string, unknown> } })
      .chrome.storage.session = {
      get: async (keys: string | string[]) =>
        Object.fromEntries(
          ([] as string[]).concat(keys).filter(k => k in session).map(k => [k, session[k]])
        ),
      set: async (entries: Record<string, unknown>) => Object.assign(session, entries)
    };

    // `src/test.ts` defines `chrome` non-configurably, so only the slice under
    // test is replaced rather than the whole namespace.
    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.cookies = {
      get: jest.fn(async ({ url, name }: { url: string, name: string }) => {
        const candidates = [...jar.values()].filter(c => c.name === name && sentFor(c, url));

        // The browser hands back the most specific match; on equal paths the
        // real tie-breaker is creation time, the host-only preference here is a
        // deterministic stand-in.
        return candidates.sort((a, b) =>
          b.path.length - a.path.length || Number(b.hostOnly) - Number(a.hostOnly))[0] ?? null;
      }),
      set: jest.fn(async (details: chrome.cookies.SetDetails) => {
        if (details.sameSite === 'no_restriction' && !details.secure) {
          throw new Error('Failed to parse or set cookie named "' + details.name + '".');
        }

        const stored = {
          path: '/',
          ...details,
          domain: hostOf(details.url),
          hostOnly: true
        } as unknown as chrome.cookies.Cookie;

        // Chrome's delete-by-overwrite: an expired cookie removes its
        // equivalent and is not stored itself.
        if (details.expirationDate !== undefined && details.expirationDate * 1000 <= Date.now()) {
          jar.delete(key(stored.name, stored.domain, stored.path));

          return null;
        }

        jar.set(key(stored.name, stored.domain, stored.path), stored);
        return stored;
      }),
      remove: jest.fn(async ({ url, name }: { url: string, name: string }) => {
        for (const [k, c] of [...jar]) {
          if (c.name === name && sentFor(c, url)) {
            jar.delete(k);
          }
        }
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
    /**
     * A cookie already in the jar is the site's, and is restored — even when
     * its value happens to equal the mock's.
     *
     * This used to assert the opposite, because equal values were read as "this
     * is the mock itself, from before a teardown lost the record". That reading
     * is unreachable now: the record survives the teardown, so a re-applied
     * mock is recognised by its id and nothing is re-recorded (the test below
     * covers exactly that). What is left here is a site cookie the mock
     * coincidentally matches — and a *recorded* mock stores the site's own
     * value, so "coincidentally" is in fact the common case.
     */
    it('treats a cookie already in the jar as the site own, matching value or not', async () => {
      seed({ name: 'session', value: 'mocked' });

      await applyCookie('example.com', mock());
      await unapplyCookie('example.com', mock());

      expect(at('session')?.value).toBe('mocked');
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

    // The parent-*domain* twin of the case above. `get({url})` also answers
    // with the site's `Domain=.example.com` cookie, while the mock's `set`
    // writes a host-only cookie — a different cookie, sitting beside it.
    // Recording the domain cookie as displaced made unapply write its old
    // value back as a host-only copy: a stale twin that keeps shadowing the
    // site's real cookie after it rotates.
    it('does not treat a parent-domain cookie as the one it displaced', async () => {
      seed({ name: 'session', value: 'domain-wide', domain: '.example.com' });

      await applyCookie('example.com', mock());

      expect(at('session')?.value).toBe('mocked');
      expect(at('session', '/', '.example.com')?.value).toBe('domain-wide');

      await unapplyCookie('example.com', mock());

      // The mock is really gone — not restored-over — and the site's domain
      // cookie survives, which also pins that unapply must not lean on
      // `chrome.cookies.remove`: its deletion filter would take the
      // `.example.com` twin with it.
      expect(at('session')).toBeUndefined();
      expect(at('session', '/', '.example.com')?.value).toBe('domain-wide');
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

    // A past expiry turns `set` into a delete, so "applying" such a mock would
    // remove the site's real cookie while the popup shows the mock as on.
    it('does not apply a mock whose expiry has already passed', async () => {
      seed({ name: 'session', value: 'real' });

      await syncCookies('example.com',
        [mock({ expirationDate: Date.now() / 1000 - 60 })], 'default', true);

      expect(at('session')?.value).toBe('real');
      expect(isApplied('example.com', 'c1')).toBe(false);
    });
  });

  /**
   * `chrome.cookies.set` can refuse a mock — `SameSite=None` without `Secure`
   * is a combination Chrome will not store. Success used to be recorded before
   * the write, so a refused mock read as applied while nothing was in the jar,
   * and a later switch-off "unapplied" a cookie the mock never wrote.
   */
  describe('a write the browser refuses', () => {
    const unstorable = () => mock({ sameSite: 'no_restriction', secure: false });

    it('records nothing: not applied, and not one of the jar own writes', async () => {
      await expect(applyCookie('example.com', unstorable())).rejects.toThrow();

      expect(isApplied('example.com', 'c1')).toBe(false);
      expect(consumeOwnWrite('example.com', 'session')).toBe(false);
    });

    it('leaves what the site sets afterwards alone when switched off', async () => {
      await syncCookies('example.com', [unstorable()], 'default', true);
      seed({ name: 'session', value: 'set-by-the-site-later' });

      await syncCookies('example.com', [unstorable()], 'default', false);

      expect(at('session')?.value).toBe('set-by-the-site-later');
    });

    it('does not keep the domain other mocks from syncing', async () => {
      await syncCookies('example.com',
        [unstorable(), mock({ id: 'c2', name: 'locale', value: 'nl' })], 'default', true);

      expect(at('locale')?.value).toBe('nl');
    });
  });

  describe('response cookies', () => {
    const state = (appActive: boolean) => ({
      version: '1.0.0',
      type: objectTypes.STATE,
      domain: 'example.com',
      aux: { appActive },
      context: { domain: 'example.com', preset: 'default' }
    } as unknown as IState);

    let records: Record<string, IState>;

    beforeEach(() => {
      records = { 'example.com': state(true) };
      jest.spyOn(StorageUtils, 'get').mockImplementation(
        ((key: string) => Promise.resolve(records[key])) as typeof StorageUtils.get);
    });

    afterEach(() => jest.restoreAllMocks());

    it('writes them while mocking is on, and takes them back out', async () => {
      await applyResponseCookies('example.com', [{ name: 'sid', value: 'fabricated' }]);
      expect(at('sid')?.value).toBe('fabricated');

      await unapplyResponseCookies('example.com');
      expect(at('sid')).toBeUndefined();
    });

    /**
     * Switching mocking off runs `unapplyResponseCookies` once; a response
     * already in flight lands *after* it. The state does not change again, so
     * no sync ever re-runs — cookies written now would re-fabricate the
     * session and keep it for the rest of the browser run. The jar therefore
     * consults the switch at the moment of writing.
     */
    it('refuses to write once mocking is switched off', async () => {
      records['example.com'] = state(false);

      await applyResponseCookies('example.com', [{ name: 'sid', value: 'fabricated' }]);

      expect(at('sid')).toBeUndefined();
    });

    it('restores the site cookie a response cookie displaced', async () => {
      seed({ name: 'sid', value: 'the-real-session' });

      await applyResponseCookies('example.com', [{ name: 'sid', value: 'fabricated' }]);
      expect(at('sid')?.value).toBe('fabricated');

      await unapplyResponseCookies('example.com');
      expect(at('sid')?.value).toBe('the-real-session');
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

  /**
   * Restoring only ever worked when switching a mock off fell in the same
   * service-worker life as switching it on.
   *
   * `displaced` — what each mock overwrote — was memory-only, and MV3 tears the
   * worker down after about thirty seconds of idle. Any other time
   * `unapplyCookie` found nothing recorded and removed the cookie outright: the
   * site's real session cookie deleted, the developer logged out of the site
   * under test. The ordinary path, not the edge.
   *
   * `forgetDisplaced()` is a worker teardown here — it clears exactly the maps
   * a teardown clears, leaving only what reached `chrome.storage.session`.
   */
  describe('surviving a service-worker teardown', () => {
    it('puts back what the mock displaced, from a worker that did not apply it', async () => {
      seed({ name: 'session', value: 'the-real-one' });

      await applyCookie('example.com', mock());
      forgetDisplaced();
      await unapplyCookie('example.com', mock());

      expect(at('session')?.value).toBe('the-real-one');
    });

    it('still removes a mock that displaced nothing', async () => {
      await applyCookie('example.com', mock({ name: 'fresh' }));
      forgetDisplaced();
      await unapplyCookie('example.com', mock({ name: 'fresh' }));

      expect(at('fresh')).toBeUndefined();
    });

    /**
     * The mirror is a whole-map write, and the message that sets a cookie is
     * usually what *wakes* the worker. Applying before reading back would put
     * one new entry over everything the previous worker recorded — losing
     * exactly the records that make restoring possible.
     */
    it('does not overwrite the mirror with the little a fresh worker knows', async () => {
      seed({ name: 'a', value: 'real-a' });
      seed({ name: 'b', value: 'real-b' });

      await applyCookie('example.com', mock({ id: 'first', name: 'a' }));
      forgetDisplaced();

      // A fresh worker, applying a different mock before anything reads back.
      await applyCookie('example.com', mock({ id: 'second', name: 'b' }));
      await unapplyCookie('example.com', mock({ id: 'first', name: 'a' }));

      expect(at('a')?.value).toBe('real-a');
    });
  });

  /**
   * A recorded mock stores the site's own current value, so enabling one
   * unchanged — freezing your session, the obvious thing to do with it — made
   * the mock's value equal the real one. `applyCookie` compared them and
   * recorded "nothing was displaced"; switching the mock off then deleted the
   * site's real cookie.
   *
   * The comparison was there to catch "this is the mock itself, from before a
   * teardown". That case cannot reach the recording branch any more, because
   * the record survives the teardown.
   */
  it('restores a cookie whose value the mock happened to match', async () => {
    seed({ name: 'session', value: 'the-real-one' });

    await applyCookie('example.com', mock({ value: 'the-real-one' }));
    // Something else changes it, so "restored" is distinguishable from "never
    // touched".
    await applyCookie('example.com', mock({ value: 'changed-by-the-mock' }));
    await unapplyCookie('example.com', mock({ value: 'changed-by-the-mock' }));

    expect(at('session')?.value).toBe('the-real-one');
  });

  it('does not restore the mock over itself after a teardown', async () => {
    await applyCookie('example.com', mock({ value: 'mocked' }));
    forgetDisplaced();

    // The same mock re-applied by a fresh worker, with the jar already holding
    // it: nothing new is recorded, so switching off still removes it.
    await applyCookie('example.com', mock({ value: 'mocked' }));
    await unapplyCookie('example.com', mock({ value: 'mocked' }));

    expect(at('session')).toBeUndefined();
  });
});
