import { appSources, objectTypes, payloadType } from '../../shared/constants';
import { IOhMyPacketContext, IPacket, IPacketPayload } from '../../shared/packet-type';
import { IOhMyCookie, IState } from '../../shared/type';
import { IOhMyCookieUpdate } from '../../shared/utils/cookie';
import { OhMyQueue } from '../../shared/utils/queue';
import { applyCookie, forgetDisplaced } from '../cookie-jar';
import { OhMyCookieHandler } from './cookie-handler';

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
    aux: {},
    presets: { default: 'Default' },
    context: { domain: 'example.com', preset: 'default' },
    ...over
  } as IState;
}

function payload(data: IOhMyCookieUpdate, domain = 'example.com'): IPacketPayload<IOhMyCookieUpdate, IOhMyPacketContext> {
  return { type: payloadType.COOKIE, data, context: { domain }, description: 'spec' };
}

describe('OhMyCookieHandler', () => {
  let records: Record<string, IOhMyCookie | IState>;
  let jar: Record<string, chrome.cookies.Cookie>;

  beforeEach(() => {
    jar = {};
    records = { 'example.com': state({ cookies: ['c1'] }), c1: cookie() };
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

    OhMyCookieHandler.StorageUtils = {
      get: jest.fn(async (key: string) => records[key]),
      set: jest.fn(async (key: string, value: IOhMyCookie) => { records[key] = value; }),
      remove: jest.fn(async (key: string) => { delete records[key]; })
    } as unknown as typeof OhMyCookieHandler.StorageUtils;

    OhMyCookieHandler.queue = { addPacket: jest.fn() } as unknown as OhMyQueue;
  });

  function queuedStateUpdate(): IPacketPayload<string[], IOhMyPacketContext> | undefined {
    const call = (OhMyCookieHandler.queue.addPacket as jest.Mock).mock.calls[0];

    return (call?.[1] as IPacket<string[], IOhMyPacketContext>)?.payload;
  }

  describe('#update', () => {
    it('refuses a cookie without a domain', async () => {
      const result = await OhMyCookieHandler.update(payload({ cookie: cookie() }, ''));

      expect(result).toBeUndefined();
      expect(OhMyCookieHandler.queue.addPacket).not.toHaveBeenCalled();
    });

    it('refuses a domain it has no state for', async () => {
      expect(await OhMyCookieHandler.update(payload({ cookie: cookie() }, 'other.com'))).toBeUndefined();
    });

    it('stores a new mock and adds its id to the state', async () => {
      records['example.com'] = state({ cookies: [] });

      const result = await OhMyCookieHandler.update(payload({ cookie: { name: 'new', value: 'v' } }));

      expect(result?.type).toBe(objectTypes.COOKIE);
      expect(records[result?.id as string]).toBe(result);

      const update = queuedStateUpdate();
      expect(update?.type).toBe(payloadType.STATE);
      expect(update?.data).toEqual([result?.id]);
      expect(update?.context).toEqual(
        { kind: 'patch', path: '$', propertyName: 'cookies', domain: 'example.com' });
    });

    it('sends the state update through the queue, not straight to storage', async () => {
      await OhMyCookieHandler.update(payload({ cookie: { name: 'new' } }));

      const call = (OhMyCookieHandler.queue.addPacket as jest.Mock).mock.calls[0];
      expect(call[0]).toBe(payloadType.STATE);
      expect((call[1] as IPacket).source).toBe(appSources.BACKGROUND);
    });

    it('patches an existing mock without touching its presets', async () => {
      const result = await OhMyCookieHandler.update(payload({ cookie: { id: 'c1', value: 'changed' } }));

      expect(result).toEqual(expect.objectContaining({
        id: 'c1', name: 'session', value: 'changed', enabled: { default: true }
      }));
      expect(result?.modifiedOn).toEqual(expect.any(String));
      // The id is already on the state
      expect(OhMyCookieHandler.queue.addPacket).not.toHaveBeenCalled();
    });

    it('removes the record and its id from the state', async () => {
      const result = await OhMyCookieHandler.update(payload({ cookie: { id: 'c1' }, remove: true }));

      expect(result).toBeUndefined();
      expect(records['c1']).toBeUndefined();
      expect(queuedStateUpdate()?.data).toEqual([]);
    });

    it('refuses to remove without an id', async () => {
      expect(await OhMyCookieHandler.update(payload({ cookie: {}, remove: true }))).toBeUndefined();
      expect(OhMyCookieHandler.queue.addPacket).not.toHaveBeenCalled();
    });

    // Deleting the record first would leave the jar unable to say what the mock
    // had replaced.
    it('puts back what the mock displaced before deleting it', async () => {
      jar['session'] = { name: 'session', value: 'real', path: '/' } as chrome.cookies.Cookie;
      await applyCookie('example.com', cookie());

      await OhMyCookieHandler.update(payload({ cookie: { id: 'c1' }, remove: true }));

      expect(jar['session'].value).toBe('real');
    });

    // The mock was never applied, so there is nothing of the extension's in the
    // jar — the cookie sitting there is the site's own.
    it('leaves the jar alone when deleting a mock that was never applied', async () => {
      jar['session'] = { name: 'session', value: 'real' } as chrome.cookies.Cookie;

      await OhMyCookieHandler.update(payload({ cookie: { id: 'c1' }, remove: true }));

      expect(jar['session'].value).toBe('real');
      expect(chrome.cookies.remove).not.toHaveBeenCalled();
    });

    it('survives a storage failure', async () => {
      OhMyCookieHandler.StorageUtils.set = jest.fn().mockRejectedValue(new Error('nope'));

      expect(await OhMyCookieHandler.update(payload({ cookie: { name: 'new' } }))).toBeUndefined();
    });
  });
});
