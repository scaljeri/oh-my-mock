import { objectTypes } from '../shared/constants';
import { IOhMyCookie, IState } from '../shared/type';
import { OhMyQueue } from '../shared/utils/queue';
import { StorageUtils } from '../shared/utils/storage';
import { applyCookie, forgetDisplaced } from './cookie-jar';
import { initCookieRecorder, OhMyCookieRecorder } from './cookie-recorder';
import { forgetSynced, syncState } from './cookie-sync';
import { OhMyCookieHandler } from './handlers/cookie-handler';

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

function state(over: Partial<IState> = {}): IState {
  return {
    version: '1.0.0',
    type: objectTypes.STATE,
    domain: 'example.com',
    aux: { appActive: true },
    presets: { default: 'Default' },
    context: { domain: 'example.com', preset: 'default' },
    cookies: [],
    ...over
  } as IState;
}

function change(over: Partial<chrome.cookies.Cookie> = {}, removed = false): chrome.cookies.CookieChangeInfo {
  return {
    removed,
    cause: 'explicit',
    cookie: {
      domain: 'example.com',
      name: 'tracker',
      value: 'from-the-server',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      session: true,
      hostOnly: true,
      storeId: '0',
      ...over
    }
  };
}

describe('OhMyCookieRecorder', () => {
  let records: Record<string, IOhMyCookie | IState>;

  beforeEach(async () => {
    records = {};
    forgetSynced();
    forgetDisplaced();
    OhMyCookieRecorder.forget();

    (globalThis as unknown as { chrome: Record<string, unknown> }).chrome.cookies = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => null),
      remove: jest.fn(async () => null),
      onChanged: { addListener: jest.fn() }
    };

    jest.spyOn(StorageUtils, 'get').mockImplementation(
      (key = 'OhMyMock') => Promise.resolve(records[key] as never));

    OhMyCookieRecorder.StorageUtils = {
      get: jest.fn(async (key: string) => records[key])
    } as unknown as typeof OhMyCookieRecorder.StorageUtils;

    OhMyCookieRecorder.CookieHandler = {
      upsert: jest.fn(async (_state: IState, update: Partial<IOhMyCookie>) => ({ ...mock(), ...update, id: 'new' }))
    } as unknown as typeof OhMyCookieRecorder.CookieHandler;

    records['example.com'] = state();
    await syncState(state()); // Makes the domain known and active
  });

  afterEach(() => jest.restoreAllMocks());

  describe('#onChanged', () => {
    it('records what a server set, switched off in every preset', async () => {
      expect(await OhMyCookieRecorder.onChanged(change())).toBe('new');
      expect(OhMyCookieRecorder.CookieHandler.upsert).toHaveBeenCalledWith(records['example.com'], {
        name: 'tracker',
        value: 'from-the-server',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        enabled: {}
      });
    });

    it('ignores a cookie being removed', async () => {
      expect(await OhMyCookieRecorder.onChanged(change({}, true))).toBeUndefined();
      expect(OhMyCookieRecorder.CookieHandler.upsert).not.toHaveBeenCalled();
    });

    it('ignores a domain the extension does not know', async () => {
      expect(await OhMyCookieRecorder.onChanged(change({ domain: 'other.com' }))).toBeUndefined();
    });

    it('ignores a domain mocking is switched off for', async () => {
      records['example.com'] = state({ aux: { appActive: false } });
      await syncState(records['example.com'] as IState);

      expect(await OhMyCookieRecorder.onChanged(change())).toBeUndefined();
    });

    it('records a cookie the server set for the parent domain', async () => {
      forgetSynced(); // Only the subdomain is known
      records['api.example.com'] = state({ domain: 'api.example.com' });
      await syncState(records['api.example.com'] as IState);

      expect(await OhMyCookieRecorder.onChanged(change({ domain: '.example.com' }))).toBe('new');
    });

    // Otherwise the extension keeps offering its own mocks back as cookies to
    // record, every time it applies them.
    it('ignores the cookie the jar just wrote itself', async () => {
      await applyCookie('example.com', mock({ name: 'tracker' }));

      expect(await OhMyCookieRecorder.onChanged(change())).toBeUndefined();
      // ... but only for that one write
      expect(await OhMyCookieRecorder.onChanged(change())).toBe('new');
    });

    it('ignores a cookie that is already mocked', async () => {
      records['c1'] = mock({ name: 'tracker' });
      records['example.com'] = state({ cookies: ['c1'] });
      await syncState(records['example.com'] as IState);

      expect(await OhMyCookieRecorder.onChanged(change())).toBeUndefined();
    });

    it('tells apart two cookies of the same name on different paths', async () => {
      records['c1'] = mock({ name: 'tracker', path: '/admin' });
      records['example.com'] = state({ cookies: ['c1'] });
      await syncState(records['example.com'] as IState);

      expect(await OhMyCookieRecorder.onChanged(change())).toBe('new');
    });

    // The state's list of ids lags a storage round trip behind, so the second
    // `Set-Cookie` would otherwise be recorded as a second mock.
    it('records the same cookie only once', async () => {
      await OhMyCookieRecorder.onChanged(change());

      expect(await OhMyCookieRecorder.onChanged(change({ value: 'again' }))).toBeUndefined();
      expect(OhMyCookieRecorder.CookieHandler.upsert).toHaveBeenCalledTimes(1);
    });

    it('can try again after a failure', async () => {
      OhMyCookieRecorder.CookieHandler.upsert = jest.fn().mockRejectedValueOnce(new Error('nope'));

      expect(await OhMyCookieRecorder.onChanged(change())).toBeUndefined();

      OhMyCookieRecorder.CookieHandler.upsert = jest.fn(async () => mock({ id: 'new' }));
      expect(await OhMyCookieRecorder.onChanged(change())).toBe('new');
    });

    it('does nothing when the state disappeared in the meantime', async () => {
      delete records['example.com'];

      expect(await OhMyCookieRecorder.onChanged(change())).toBeUndefined();
    });
  });

  describe('#initCookieRecorder', () => {
    it('listens for cookie changes', async () => {
      const queue = { addPacket: jest.fn() } as unknown as OhMyQueue;
      initCookieRecorder(queue);

      expect(OhMyCookieHandler.queue).toBe(queue);

      const listener = (chrome.cookies.onChanged.addListener as jest.Mock).mock.calls[0][0];
      await listener(change());

      expect(OhMyCookieRecorder.CookieHandler.upsert).toHaveBeenCalled();
    });
  });
});
