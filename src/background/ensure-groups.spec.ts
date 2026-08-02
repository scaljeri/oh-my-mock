import { objectTypes } from '../shared/constants';
import { IOhMyGroup, IOhMyMock } from '../shared/type';
import { GroupUtils } from '../shared/utils/group';
import { StorageUtils } from '../shared/utils/storage';
import { ensureGroups } from './ensure-groups';

function store(over: Partial<IOhMyMock> = {}): IOhMyMock {
  return {
    version: '1.0.0',
    type: objectTypes.STORE,
    domains: ['example.com'],
    ...over
  } as IOhMyMock;
}

const groupsIn = (records: Record<string, unknown>): IOhMyGroup[] =>
  Object.values(records).filter((v): v is IOhMyGroup => GroupUtils.isGroup(v));

describe('ensure-groups', () => {
  let records: Record<string, unknown>;

  beforeEach(() => {
    records = {};

    StorageUtils.chrome = {
      storage: {
        local: {
          // Two shapes on purpose: `chrome.storage.local.get` resolves a
          // promise when given no callback — how the whole-storage read works —
          // and calls the callback when given one, which is what
          // `StorageUtils.getMany` uses.
          get: jest.fn(
            async (
              keys: unknown,
              callback?: (data: Record<string, unknown>) => void
            ) => {
              const data =
                keys === null
                  ? { ...records }
                  : Object.fromEntries(
                      (Array.isArray(keys) ? keys : [keys as string])
                        .filter(k => k in records)
                        .map(k => [k, records[k]])
                    );

              callback?.(data);

              return data;
            }
          )
        }
      }
    } as unknown as typeof StorageUtils.chrome;

    jest
      .spyOn(StorageUtils, 'set')
      .mockImplementation(async (key: string, value: unknown) => {
        records[key] = value;
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it('gives a domain that has none a local group, and lists it', async () => {
    const updated = await ensureGroups(store());
    const [group] = groupsIn(records);

    expect(group).toEqual(
      expect.objectContaining({
        type: objectTypes.GROUP,
        source: 'local',
        domains: ['example.com'],
        name: GroupUtils.DEFAULT_LOCAL_NAME
      })
    );
    expect(updated.groups).toEqual([group.id]);
  });

  it('gives each domain its own', async () => {
    const updated = await ensureGroups(
      store({ domains: ['a.com', 'b.com'] })
    );

    expect(groupsIn(records).map(g => g.domains)).toEqual([['a.com'], ['b.com']]);
    expect(updated.groups).toHaveLength(2);
  });

  /**
   * The trigger is the shape, not a version — so this runs on every startup and
   * must not pile up a group per boot. That is what a version gate would have
   * got wrong in the other direction: never running at all.
   */
  it('is a no-op the second time', async () => {
    const first = await ensureGroups(store());
    const before = { ...records };

    const second = await ensureGroups(first);

    expect(records).toEqual(before);
    expect(second.groups).toEqual(first.groups);
    expect(groupsIn(records)).toHaveLength(1);
  });

  /**
   * This runs on every store write — the popup opening is one — so the
   * whole-storage read has to be the exception. It costs the same as reading
   * every mock the browser holds.
   */
  it('does not read the whole of storage once every domain has a group', async () => {
    const first = await ensureGroups(store());
    const reads = StorageUtils.chrome.storage.local.get as jest.Mock;
    reads.mockClear();

    await ensureGroups(first);

    expect(reads).toHaveBeenCalled();
    expect(reads.mock.calls.some(([keys]) => keys === null)).toBe(false);
  });

  it('leaves a group somebody renamed alone', async () => {
    const first = await ensureGroups(store());
    const [group] = groupsIn(records);
    records[group.id] = { ...group, name: 'Renamed' };

    await ensureGroups(first);

    expect((records[group.id] as IOhMyGroup).name).toBe('Renamed');
    expect(groupsIn(records)).toHaveLength(1);
  });

  it('does not count a cloud group as the domain own', async () => {
    const cloud = GroupUtils.init({
      source: 'cloud',
      domains: ['example.com']
    });
    records[cloud.id] = cloud;

    const updated = await ensureGroups(store());

    expect(groupsIn(records).filter(g => g.source === 'local')).toHaveLength(1);
    // And the cloud group it found is adopted into the order rather than left
    // to sort last for ever with nobody able to drag it.
    expect(updated.groups).toContain(cloud.id);
  });

  it('adopts a group the store list never heard of, keeping the stated order', async () => {
    const stray = GroupUtils.init({ source: 'local', domains: ['example.com'] });
    records[stray.id] = stray;
    const other = GroupUtils.init({ source: 'cloud', domains: ['x.com'] });
    records[other.id] = other;

    const updated = await ensureGroups(store({ groups: [other.id] }));

    expect(updated.groups).toEqual([other.id, stray.id]);
  });

  it('writes no request records — membership is the absent tag', async () => {
    records['r1'] = { id: 'r1', type: objectTypes.REQUEST };

    await ensureGroups(store());

    expect(records['r1']).toEqual({ id: 'r1', type: objectTypes.REQUEST });
  });
});
