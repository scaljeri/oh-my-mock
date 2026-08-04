import { objectTypes } from '../shared/constants';
import { IData, IState } from '../shared/type';
import { StorageUtils } from '../shared/utils/storage';
import { liftOutRequests } from './lift-out-requests';

function request(over: Partial<IData> = {}): IData {
  return {
    id: 'r1',
    version: '1.0.0',
    type: objectTypes.REQUEST,
    url: '/api/users',
    method: 'GET',
    requestType: 'FETCH',
    enabled: {},
    mocks: {},
    ...over
  } as IData;
}

/** A domain record in the shape that predates the move. */
function legacyState(data: Record<string, IData>): unknown {
  return {
    version: '1.0.0',
    type: objectTypes.STATE,
    domain: 'example.com',
    aux: { appActive: true },
    presets: { default: 'Default' },
    context: { domain: 'example.com', preset: 'default' },
    data
  };
}

describe('lift-out-requests', () => {
  let records: Record<string, unknown>;
  let session: Record<string, unknown>;

  beforeEach(() => {
    records = {};

    // MV3 `chrome.storage.local.get` resolves a promise when given no
    // callback, which is how `liftOutRequests` reads the whole of storage.
    StorageUtils.chrome = {
      storage: {
        local: {
          get: jest.fn(async (keys: unknown) => (keys === null ? { ...records } : {}))
        }
      }
    } as unknown as typeof StorageUtils.chrome;

    jest.spyOn(StorageUtils, 'set').mockImplementation(async (key: string, value: unknown) => {
      records[key] = value;
    });

    // The scan marks the browser session as checked, so it does not repeat on
    // every service-worker start.
    session = {};
    (chrome.storage as unknown as Record<string, unknown>).session = {
      get: async (key: string) => ({ [key]: session[key] }),
      set: async (entries: Record<string, unknown>) => Object.assign(session, entries)
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it('gives each embedded request a record of its own', async () => {
    records['example.com'] = legacyState({ r1: request(), r2: request({ id: 'r2' }) });

    const lifted = await liftOutRequests();

    expect(lifted).toBe(2);
    expect(records['r1']).toEqual(expect.objectContaining({ id: 'r1', url: '/api/users' }));
    expect(records['r2']).toEqual(expect.objectContaining({ id: 'r2' }));
  });

  it('lists the ids on the state and drops the embedded copy', async () => {
    records['example.com'] = legacyState({ r1: request(), r2: request({ id: 'r2' }) });

    await liftOutRequests();
    const state = records['example.com'] as IState & { data?: unknown };

    expect(state.requests).toEqual(['r1', 'r2']);
    expect('data' in state).toBe(false);
  });

  // The whole point: a developer's stored mocks must survive the move. The
  // migration step this replaces deleted `data` outright.
  it('keeps everything the request held', async () => {
    const full = request({ mocks: { m1: { id: 'm1' } } as unknown as IData['mocks'] });
    records['example.com'] = legacyState({ r1: full });

    await liftOutRequests();

    expect(records['r1']).toEqual(expect.objectContaining({ mocks: { m1: { id: 'm1' } } }));
  });

  // Embedded requests were keyed by id but did not have to carry one.
  it('stamps the key onto a request that lacks an id', async () => {
    const without = request();
    delete (without as Partial<IData>).id;
    records['example.com'] = legacyState({ r7: without });

    await liftOutRequests();

    expect((records['r7'] as IData).id).toBe('r7');
  });

  it('leaves an already-lifted profile alone', async () => {
    records['example.com'] = {
      version: '1.0.0', type: objectTypes.STATE, domain: 'example.com', requests: ['r1']
    };
    records['r1'] = request();

    expect(await liftOutRequests()).toBe(0);
    expect((records['example.com'] as IState).requests).toEqual(['r1']);
  });

  it('runs twice without changing anything the second time', async () => {
    records['example.com'] = legacyState({ r1: request() });

    await liftOutRequests();
    const afterFirst = JSON.stringify(records);

    expect(await liftOutRequests()).toBe(0);
    expect(JSON.stringify(records)).toBe(afterFirst);
  });

  // A half-moved profile: the record is the one the new code wrote, so the
  // stale embedded copy must not overwrite it.
  it('does not let a stale embedded copy overwrite a newer record', async () => {
    records['example.com'] = legacyState({ r1: request({ url: '/stale' }) });
    records['r1'] = request({ url: '/fresh' });

    await liftOutRequests();

    expect((records['r1'] as IData).url).toBe('/fresh');
    expect((records['example.com'] as IState).requests).toEqual(['r1']);
  });

  // Request ids and mock ids come from the same keyspace. Writing over the
  // occupant would destroy a stored mock; listing the id anyway would point the
  // domain at that mock as though it were a request.
  it('refuses to lift a request onto a key another record holds', async () => {
    records['example.com'] = legacyState({ m1: request({ id: 'm1' }), r2: request({ id: 'r2' }) });
    records['m1'] = { version: '1.0.0', type: objectTypes.MOCK, id: 'm1' };

    expect(await liftOutRequests()).toBe(1);
    expect(records['m1']).toEqual(expect.objectContaining({ type: objectTypes.MOCK }));
    expect((records['example.com'] as IState).requests).toEqual(['r2']);
  });

  it('ignores records that are not states', async () => {
    records['OhMyMock'] = { version: '1.0.0', type: objectTypes.STORE, domains: ['example.com'] };
    records['m1'] = { version: '1.0.0', type: objectTypes.MOCK, id: 'm1' };

    expect(await liftOutRequests()).toBe(0);
    expect(records['OhMyMock']).toEqual(expect.objectContaining({ type: objectTypes.STORE }));
  });

  it('normalises a state whose embedded map is empty', async () => {
    records['example.com'] = legacyState({});

    await liftOutRequests();
    const state = records['example.com'] as IState & { data?: unknown };

    expect(state.requests).toEqual([]);
    expect('data' in state).toBe(false);
  });

  it('drops a malformed entry rather than writing it out', async () => {
    records['example.com'] = legacyState({ r1: null as unknown as IData, r2: request({ id: 'r2' }) });

    expect(await liftOutRequests()).toBe(1);
    expect(records['r1']).toBeUndefined();
    expect((records['example.com'] as IState).requests).toEqual(['r2']);
  });

  it('preserves the rest of the domain record', async () => {
    records['example.com'] = legacyState({ r1: request() });

    await liftOutRequests();
    const state = records['example.com'] as IState;

    expect(state.aux).toEqual({ appActive: true });
    expect(state.presets).toEqual({ default: 'Default' });
    expect(state.domain).toBe('example.com');
  });

  /**
   * The scan is `chrome.storage.local.get(null)` — every record the browser
   * holds, base64 bodies and all. It runs from `initStorage`, and MV3 tears the
   * worker down after about thirty seconds of idle, so on an active tab it was
   * repeating for a migration that finishes on the first pass.
   */
  describe('how often it looks', () => {
    it('does not read storage again once it has run', async () => {
      records['example.com'] = legacyState({ r1: request() });

      await liftOutRequests();
      const reads = StorageUtils.chrome.storage.local.get as jest.Mock;
      reads.mockClear();

      expect(await liftOutRequests()).toBe(0);
      expect(reads).not.toHaveBeenCalled();
    });

    /**
     * A session marker, not a stored one: the check has to happen again after
     * an extension update, and this gets that without a version gate — which is
     * the mechanism this file exists to avoid.
     */
    it('looks again in a new browser session', async () => {
      records['example.com'] = legacyState({ r1: request() });
      await liftOutRequests();

      session = {};
      (chrome.storage as unknown as Record<string, unknown>).session = {
        get: async (key: string) => ({ [key]: session[key] }),
        set: async (entries: Record<string, unknown>) => Object.assign(session, entries)
      };

      const reads = StorageUtils.chrome.storage.local.get as jest.Mock;
      reads.mockClear();
      await liftOutRequests();

      expect(reads).toHaveBeenCalled();
    });
  });
});
