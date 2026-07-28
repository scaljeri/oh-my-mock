import { objectTypes } from '../shared/constants';
import { IOhMyCookie, IOhMyMock, IState } from '../shared/type';
import { IOhMyStorageChange, StorageUtils } from '../shared/utils/storage';
import { forgetDisplaced } from './cookie-jar';
import {
  activeDomains, domainOfCookie, forgetState, forgetSynced, handleStorageUpdate, isCookieMockingActive,
  loadCookies, primeCookieSync, signatureOf, syncCookieRecord, syncedCookies, syncState
} from './cookie-sync';

function cookie(over: Partial<IOhMyCookie> = {}): IOhMyCookie {
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

function state(over: Partial<IState> = {}): IState {
  return {
    version: '1.0.0',
    type: objectTypes.STATE,
    domain: 'example.com',
    aux: { appActive: true },
    presets: { default: 'Default' },
    context: { domain: 'example.com', preset: 'default' },
    cookies: ['c1'],
    ...over
  } as IState;
}

describe('cookie-sync', () => {
  let jar: Record<string, chrome.cookies.Cookie>;
  let records: Record<string, IOhMyCookie | IState | IOhMyMock>;

  beforeEach(() => {
    jar = {};
    records = { c1: cookie() };
    forgetSynced();
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

    jest.spyOn(StorageUtils, 'get').mockImplementation(
      (key = 'OhMyMock') => Promise.resolve(records[key] as never));
  });

  afterEach(() => jest.restoreAllMocks());

  describe('#isCookieMockingActive', () => {
    // Deliberately not tied to the popup: a cookie needs nothing from it, and
    // closing the window should not drop a mocked session.
    it('follows the domain switch', () => {
      expect(isCookieMockingActive(state({ aux: { appActive: true } }))).toBe(true);
      expect(isCookieMockingActive(state({ aux: {} }))).toBe(false);
    });
  });

  describe('#signatureOf', () => {
    it('changes when the switch, the preset or the mocks change', () => {
      const base = signatureOf(state());

      expect(signatureOf(state({ aux: {} }))).not.toBe(base);
      expect(signatureOf(state({ context: { domain: 'example.com', preset: 'other' } }))).not.toBe(base);
      expect(signatureOf(state({ cookies: ['c1', 'c2'] }))).not.toBe(base);
      expect(signatureOf(state())).toBe(base);
    });
  });

  describe('#loadCookies', () => {
    it('skips a record that is not stored yet', async () => {
      expect(await loadCookies(['c1', 'nope'])).toEqual([cookie()]);
    });
  });

  describe('#syncState', () => {
    it('applies the enabled mocks of an active domain', async () => {
      await syncState(state());

      expect(jar['session'].value).toBe('mocked');
    });

    it('applies nothing while the domain is switched off', async () => {
      await syncState(state({ aux: { appActive: false } }));

      expect(jar['session']).toBeUndefined();
    });

    it('unapplies when the domain is switched off', async () => {
      await syncState(state());
      await syncState(state({ aux: { appActive: false } }));

      expect(jar['session']).toBeUndefined();
    });

    it('unapplies when the preset changes to one the mock is off in', async () => {
      records['c1'] = cookie({ enabled: { default: true, 'logged-out': false } });

      await syncState(state());
      await syncState(state({ context: { domain: 'example.com', preset: 'logged-out' } }));

      expect(jar['session']).toBeUndefined();
    });

    // Storage writes are frequent — a request being recorded rewrites the
    // state — and none of them concern cookies.
    it('does nothing when nothing it depends on changed', async () => {
      await syncState(state());
      (StorageUtils.get as jest.Mock).mockClear();

      await syncState(state());

      expect(StorageUtils.get).not.toHaveBeenCalled();
    });

    // Its record is gone, so nothing later on can work out what to undo.
    it('unapplies a mock that is no longer on the state', async () => {
      await syncState(state());
      expect(jar['session']).toBeDefined();

      delete records['c1'];
      await syncState(state({ cookies: [] }));

      expect(jar['session']).toBeUndefined();
    });

    it('syncs again when forced', async () => {
      await syncState(state());
      records['c1'] = cookie({ value: 'changed' });

      await syncState(state(), true);

      expect(jar['session'].value).toBe('changed');
    });
  });

  describe('#handleStorageUpdate', () => {
    function change(newValue?: unknown, oldValue?: unknown): IOhMyStorageChange {
      return { newValue, oldValue } as IOhMyStorageChange;
    }

    it('syncs the domain whose state changed', async () => {
      await handleStorageUpdate('example.com', change(state()));

      expect(jar['session'].value).toBe('mocked');
    });

    it('ignores a record that is neither a state nor a cookie', async () => {
      await handleStorageUpdate('mock-id', change({ type: objectTypes.MOCK }));

      expect(jar['session']).toBeUndefined();
    });

    // The id in `state.cookies` does not change when the mock itself does, so
    // the state's signature does not either.
    it('picks up a changed cookie mock', async () => {
      records['example.com'] = state();
      await handleStorageUpdate('example.com', change(state()));

      records['c1'] = cookie({ value: 'changed' });
      await handleStorageUpdate('c1', change(records['c1']));

      expect(jar['session'].value).toBe('changed');
    });

    it('unapplies everything when the state is removed', async () => {
      await handleStorageUpdate('example.com', change(state()));
      expect(jar['session']).toBeDefined();

      await handleStorageUpdate('example.com', change(undefined, state()));

      expect(jar['session']).toBeUndefined();
    });

    it('survives a sync that throws', async () => {
      jest.spyOn(StorageUtils, 'get').mockRejectedValue(new Error('nope'));

      await expect(handleStorageUpdate('example.com', change(state()))).resolves.toBeUndefined();
    });
  });

  describe('#syncCookieRecord', () => {
    it('does nothing for a mock no domain claims yet', async () => {
      await syncCookieRecord('c1');

      expect(jar['session']).toBeUndefined();
    });
  });

  describe('#forgetState', () => {
    // The cookie records are deleted along with the state, so what to unapply
    // has to come from what was last synced.
    it('unapplies from what it remembers, not from storage', async () => {
      await syncState(state());
      records = {};

      await forgetState('example.com');

      expect(jar['session']).toBeUndefined();
      expect(domainOfCookie('c1')).toBeUndefined();
    });
  });

  describe('#primeCookieSync', () => {
    beforeEach(() => {
      records['OhMyMock'] = { domains: ['example.com'] } as IOhMyMock;
      records['example.com'] = state();
    });

    it('re-applies what a restarted worker should have applied', async () => {
      await primeCookieSync();

      expect(jar['session'].value).toBe('mocked');
      expect(activeDomains()).toEqual(['example.com']);
      expect(syncedCookies('example.com')).toEqual([cookie()]);
    });

    // A fresh worker knows of nothing it applied, so it must not remove
    // anything either — that cookie is the site's own.
    it('never removes a cookie on start', async () => {
      records['c1'] = cookie({ enabled: { default: false } });
      jar['session'] = { name: 'session', value: 'real' } as chrome.cookies.Cookie;

      await primeCookieSync();

      expect(jar['session'].value).toBe('real');
    });
  });
});
