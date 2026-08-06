import { objectTypes, STORAGE_KEY } from '../shared/constants';
import { IOhMyMock, IState } from '../shared/type';
import { GroupUtils } from '../shared/utils/group';
import { MigrateUtils } from '../shared/utils/migrate';
import { StateUtils } from '../shared/utils/state';
import { StorageUtils } from '../shared/utils/storage';
import { initStorage } from './init';
import { addDomain } from './store-writer';

/** A storage round trip that does not finish in the turn it started in. */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

describe('initStorage', () => {
  let records: Record<string, unknown>;
  let writes: string[];
  const realChrome = StorageUtils.chrome;

  const stored = (): IOhMyMock => records[STORAGE_KEY] as IOhMyMock;

  beforeEach(() => {
    const group = GroupUtils.defaultLocalFor('listed.example');

    records = {
      [STORAGE_KEY]: {
        type: objectTypes.STORE,
        version: MigrateUtils.version,
        domains: ['listed.example'],
        groups: [group.id]
      } as IOhMyMock,
      [group.id]: group,
      'listed.example': StateUtils.init({ domain: 'listed.example' })
    };
    writes = [];

    // A turn late on purpose: startup reads the store, then scans the whole of
    // storage and does a group pass before writing it back, and what happens in
    // that gap is the point of these tests.
    jest.spyOn(StorageUtils, 'get').mockImplementation(async (key = STORAGE_KEY) => {
      await tick();

      return records[key] as never;
    });
    jest.spyOn(StorageUtils, 'set').mockImplementation(async (key: string, value: unknown) => {
      await tick();
      records[key] = value;
      writes.push(key);
    });
    jest.spyOn(StorageUtils, 'setStore').mockImplementation(async (value: IOhMyMock) => {
      await tick();
      records[STORAGE_KEY] = value;
      writes.push(STORAGE_KEY);
    });
    jest.spyOn(StorageUtils, 'getMany').mockImplementation(async (keys: string[]) => {
      await tick();

      return Object.fromEntries(keys.filter(k => k in records).map(k => [k, records[k]])) as never;
    });
    jest.spyOn(StorageUtils, 'remove').mockImplementation(async (key) => {
      delete records[key as string];
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
    jest.restoreAllMocks();
    StorageUtils.chrome = realChrome;
  });

  /**
   * MV3 restarts the service worker after about thirty seconds of idle, and the
   * message that woke it is handled while startup is still running. Startup
   * used to read the store at the top of the function and write it at the
   * bottom, with a whole-storage scan and a group pass in between — so a domain
   * registered in that gap was written straight back out again, and its
   * requests and mocks were left in storage with nothing listing them.
   */
  it('keeps a domain registered while it was starting up', async () => {
    await Promise.all([
      initStorage('woke-us.example'),
      addDomain('brand-new.example')
    ]);

    expect([...stored().domains].sort()).toEqual([
      'brand-new.example',
      'listed.example',
      'woke-us.example'
    ]);
  });

  it('writes nothing when there is nothing to change', async () => {
    // Every thirty seconds of idle costs a worker restart, and this used to
    // rewrite the store on each one — a change every content script in the
    // browser then heard about through `chrome.storage.onChanged`.
    await initStorage('listed.example');

    expect(writes).not.toContain(STORAGE_KEY);
  });

  it('creates the domain record only when there is none', async () => {
    const before = records['listed.example'];

    await initStorage('listed.example');

    expect(records['listed.example']).toBe(before);
  });

  it('creates a record for a domain that has none', async () => {
    await initStorage('woke-us.example');

    expect((records['woke-us.example'] as IState)?.domain).toBe('woke-us.example');
    expect(stored().domains).toContain('woke-us.example');
  });
});
