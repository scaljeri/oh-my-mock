import { objectTypes, STORAGE_KEY } from '../shared/constants';
import { IOhMyMock } from '../shared/type';
import { GroupUtils } from '../shared/utils/group';
import { StorageUtils } from '../shared/utils/storage';
import { addDomain, clearStore, mutateStore } from './store-writer';

/** A storage round trip that does not finish in the turn it started in. */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/**
 * The store record used to be read, changed and written back by four places at
 * once, and none of them knew about the others. These tests are about what
 * happens *between* the read and the write, so every double here resolves a
 * turn late on purpose: a fake that answers synchronously interleaves nothing
 * and would pass whatever the code did.
 */
describe('store-writer', () => {
  let records: Record<string, unknown>;
  let writes: string[];
  const realChrome = StorageUtils.chrome;

  const store = (over: Partial<IOhMyMock> = {}): IOhMyMock => ({
    type: objectTypes.STORE,
    version: '1.0.0',
    domains: [],
    ...over
  } as IOhMyMock);

  const stored = (): IOhMyMock => records[STORAGE_KEY] as IOhMyMock;

  beforeEach(() => {
    records = { [STORAGE_KEY]: store() };
    writes = [];

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

    // `ensureGroups` reads the whole of storage when a domain has no group yet.
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

  it('applies each change to the record the one before it left behind', async () => {
    // Both start before either has read anything — the shape of every
    // collision this module exists to stop. Reading the record outside the
    // queue, as all four writers used to, means both see `domains: []` and
    // whichever writes last is the only one that happened.
    await Promise.all([
      mutateStore(s => ({ ...s, domains: ['a', ...s.domains] })),
      mutateStore(s => ({ ...s, domains: ['b', ...s.domains] }))
    ]);

    expect([...stored().domains].sort()).toEqual(['a', 'b']);
  });

  it('keeps a field one change set while another changes a different one', async () => {
    await Promise.all([
      mutateStore(s => ({ ...s, popupActive: true })),
      mutateStore(s => ({ ...s, domains: ['a', ...s.domains] }))
    ]);

    expect(stored().popupActive).toBe(true);
    expect(stored().domains).toEqual(['a']);
  });

  it('writes nothing when a change decides there is nothing to change', async () => {
    await mutateStore(() => undefined);

    expect(writes).toEqual([]);
  });

  it('writes the record when there was none', async () => {
    delete records[STORAGE_KEY];

    await mutateStore(() => undefined);

    expect(stored()).toBeDefined();
    expect(stored().type).toBe(objectTypes.STORE);
  });

  it('lets the next change through after one of them throws', async () => {
    // The chain is what keeps writes in order, so a rejection must not leave it
    // permanently rejected — every store write for the rest of the worker's
    // life would go with it.
    await expect(mutateStore(() => {
      throw new Error('nope');
    })).rejects.toThrow('nope');

    await addDomain('a');

    expect(stored().domains).toEqual(['a']);
  });

  describe('clearStore', () => {
    it('leaves nothing of a change that was in flight when it ran', async () => {
      records[STORAGE_KEY] = store({ domains: ['a'] });
      jest.spyOn(StorageUtils, 'reset').mockImplementation(async () => {
        await tick();
        records = {};
      });

      await Promise.all([addDomain('b'), clearStore()]);

      // A wipe that ran beside the queue rather than in it would be followed by
      // the other change writing the record back — with domains whose records
      // had just been deleted.
      expect(stored().domains).toEqual([]);
    });
  });

  describe('addDomain', () => {
    it('adds to the list as it stands rather than replacing it', async () => {
      records[STORAGE_KEY] = store({ domains: ['a'] });

      await Promise.all([addDomain('b'), addDomain('c')]);

      expect([...stored().domains].sort()).toEqual(['a', 'b', 'c']);
    });

    it('writes nothing for a domain that is already listed', async () => {
      // With its group already there, so `ensureGroups` has nothing to add
      // either — otherwise the write under test is its doing rather than this
      // one's.
      const group = GroupUtils.defaultLocalFor('a');

      records[group.id] = group;
      records[STORAGE_KEY] = store({ domains: ['a'], groups: [group.id] });

      await addDomain('a');

      expect(writes).not.toContain(STORAGE_KEY);
    });
  });
});
