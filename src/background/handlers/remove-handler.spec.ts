import { objectTypes, payloadType, STORAGE_KEY } from '../../shared/constants';
import { IOhMyPacketContext, IPacket, IPacketPayload } from '../../shared/packet-type';
import { IData, IOhMyCookie, IOhMyMock, IState } from '../../shared/type';
import { OhMyQueue } from '../../shared/utils/queue';
import { StorageUtils } from '../../shared/utils/storage';
import { applyCookie, forgetDisplaced } from '../cookie-jar';
import { addDomain } from '../store-writer';
import * as bgUtils from '../utils';
import { IOhMyRemoval, OhMyRemoveHandler } from './remove-handler';

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
    requests: ['r1'],
    cookies: ['c1'],
    aux: {},
    presets: { default: 'Default' },
    context: { domain: 'example.com', preset: 'default' },
    ...over
  } as IState;
}

function request(over: Partial<IData> = {}): IData {
  return {
    id: 'r1',
    type: objectTypes.REQUEST,
    mocks: { m1: { id: 'm1', statusCode: 200 } },
    selected: { default: 'm1' },
    enabled: { default: true },
    ...over
  } as IData;
}

function payload(data: IOhMyRemoval, domain = 'example.com'): IPacketPayload<IOhMyRemoval> {
  return { type: payloadType.REMOVE, data, context: { domain }, description: 'spec' };
}

describe('OhMyRemoveHandler', () => {
  let records: Record<string, unknown>;
  let jar: Record<string, chrome.cookies.Cookie>;
  let addPacket: jest.Mock;

  beforeEach(() => {
    records = {
      'example.com': state(),
      r1: request(),
      m1: { id: 'm1' },
      c1: cookie()
    };
    jar = {};
    forgetDisplaced();

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

    // The handler reaches storage both through its static and through the bare
    // import; they are the same object, so spying on the class covers both.
    jest.spyOn(StorageUtils, 'get').mockImplementation(async (key?: string) => records[key as string] as never);
    jest.spyOn(StorageUtils, 'getMany').mockImplementation(async (keys: string[]) =>
      keys.reduce((acc, k) => (records[k] ? { ...acc, [k]: records[k] } : acc), {}) as never);
    jest.spyOn(StorageUtils, 'remove').mockImplementation(async (key) => { delete records[key as string]; });
    jest.spyOn(StorageUtils, 'setStore').mockResolvedValue(undefined);

    // The queue answers a packet through its callback, like the real one does.
    addPacket = jest.fn((type, packet: IPacket, done?: (r: unknown) => void) => done?.(packet.payload));
    OhMyRemoveHandler.queue = { addPacket } as unknown as OhMyQueue;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('STATE removal', () => {
    // The cookie mocks are records of their own, and this branch used to forget
    // them: every cookie mock of a deleted domain stayed in storage forever,
    // unreferenced.
    it('removes the cookie records of the domain', async () => {
      await OhMyRemoveHandler.update(payload({ type: objectTypes.STATE }));

      expect(records['c1']).toBeUndefined();
      expect(records['example.com']).toBeUndefined();
    });

    // Same rule as the cookie handler's own delete: the jar identifies what the
    // mock displaced by its record, so unapplying after the record is gone
    // would have nothing left to restore the site's real cookie from.
    it('puts back what an applied cookie mock displaced before deleting its record', async () => {
      jar['session'] = { name: 'session', value: 'real', path: '/' } as chrome.cookies.Cookie;
      await applyCookie('example.com', cookie());

      await OhMyRemoveHandler.update(payload({ type: objectTypes.STATE }));

      expect(jar['session'].value).toBe('real');
    });

    it('leaves the jar alone for a cookie mock that was never applied', async () => {
      jar['session'] = { name: 'session', value: 'real' } as chrome.cookies.Cookie;

      await OhMyRemoveHandler.update(payload({ type: objectTypes.STATE }));

      expect(jar['session'].value).toBe('real');
      expect(chrome.cookies.remove).not.toHaveBeenCalled();
    });

    it('survives a state that predates cookie mocks', async () => {
      records['example.com'] = state({ cookies: undefined });

      await OhMyRemoveHandler.update(payload({ type: objectTypes.STATE }));

      expect(records['example.com']).toBeUndefined();
    });
  });

  describe('REQUEST removal', () => {
    it('removes the responses, the record and its place in the list', async () => {
      await OhMyRemoveHandler.update(payload({ type: objectTypes.REQUEST, id: 'r1' }));

      expect(records['m1']).toBeUndefined();
      expect(records['r1']).toBeUndefined();

      const update = (addPacket.mock.calls[0]?.[1] as IPacket<string[], IOhMyPacketContext>)?.payload;
      expect(update?.data).toEqual([]);
      expect(update?.context).toEqual(
        { kind: 'patch', path: '$', propertyName: 'requests', domain: 'example.com' });
    });

    // A listed id whose record is gone is evidence of an interrupted or
    // out-of-band delete: any mocks that record still owned are orphaned for
    // good, because their ids lived only on it. The old `request?.mocks ?? {}`
    // swallowed that without a trace; it has to be said, and the stale id
    // still has to leave the list.
    it('warns when the record is already gone, and still heals the list', async () => {
      const warned = jest.spyOn(bgUtils, 'warn').mockImplementation(() => undefined);
      delete records['r1'];

      await OhMyRemoveHandler.update(payload({ type: objectTypes.REQUEST, id: 'r1' }));

      expect(warned).toHaveBeenCalled();

      const update = (addPacket.mock.calls[0]?.[1] as IPacket<string[], IOhMyPacketContext>)?.payload;
      expect(update?.data).toEqual([]);
    });

    it('does not warn when the record is where the list says it is', async () => {
      const warned = jest.spyOn(bgUtils, 'warn').mockImplementation(() => undefined);

      await OhMyRemoveHandler.update(payload({ type: objectTypes.REQUEST, id: 'r1' }));

      expect(warned).not.toHaveBeenCalled();
    });
  });

  /**
   * Forgetting a domain takes it out of the store's list, and deleting the
   * mocks, requests and cookies that come first takes a while. The list used to
   * be read before all of that and written after, so a domain that arrived in
   * the meantime — a site being activated in another tab, an import finishing —
   * was written straight back out again, and with it the group `ensureGroups`
   * had just created for it.
   */
  describe('forgetting the domain', () => {
    const realChrome = StorageUtils.chrome;
    const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

    beforeEach(() => {
      records[STORAGE_KEY] = {
        type: objectTypes.STORE,
        version: '1.0.0',
        domains: ['example.com', 'other.example'],
        groups: []
      } as IOhMyMock;

      // Slower doubles than the suite's own: what is under test here happens
      // between a read and the write that follows it.
      jest.spyOn(StorageUtils, 'get').mockImplementation(async (key = STORAGE_KEY) => {
        await tick();

        return records[key] as never;
      });
      jest.spyOn(StorageUtils, 'set').mockImplementation(async (key: string, value: unknown) => {
        await tick();
        records[key] = value;
      });
      jest.spyOn(StorageUtils, 'setStore').mockImplementation(async (store: IOhMyMock) => {
        await tick();
        records[STORAGE_KEY] = store;
      });
      StorageUtils.chrome = {
        storage: {
          local: {
            get: jest.fn(async (keys: unknown) => (keys === null ? { ...records } : {}))
          }
        }
      } as unknown as typeof StorageUtils.chrome;
    });

    afterEach(() => {
      StorageUtils.chrome = realChrome;
    });

    it('takes the domain out of the list', async () => {
      await OhMyRemoveHandler.update(payload({ type: objectTypes.STATE, removeDomain: true }));

      expect((records[STORAGE_KEY] as IOhMyMock).domains).toEqual(['other.example']);
    });

    it('keeps a domain that was registered while it was deleting', async () => {
      await Promise.all([
        OhMyRemoveHandler.update(payload({ type: objectTypes.STATE, removeDomain: true })),
        addDomain('brand-new.example')
      ]);

      expect([...(records[STORAGE_KEY] as IOhMyMock).domains].sort())
        .toEqual(['brand-new.example', 'other.example']);
    });

    // Emptying a domain and forgetting it are different things: the menu's
    // "Reset state" is the first, and without the flag this branch left the
    // domain listed while its record had just been deleted.
    it('leaves the domain listed when it is only being emptied', async () => {
      await OhMyRemoveHandler.update(payload({ type: objectTypes.STATE }));

      expect((records[STORAGE_KEY] as IOhMyMock).domains).toContain('example.com');
    });
  });
});
