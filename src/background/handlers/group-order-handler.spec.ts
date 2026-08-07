import { objectTypes, payloadType, STORAGE_KEY } from '../../shared/constants';
import { IOhMyGroupMove, IOhMyPacketContext, IPacketPayload } from '../../shared/packet-type';
import { IOhMyGroup, IOhMyMock } from '../../shared/type';
import { GroupUtils } from '../../shared/utils/group';
import { StorageUtils } from '../../shared/utils/storage';
import { mutateStore } from '../store-writer';
import { OhMyGroupOrderHandler } from './group-order-handler';

/** A storage round trip that does not finish in the turn it started in. */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const DOMAIN = 'example.com';

/**
 * Moving a group is not moving a row: `IOhMyMock.groups` is the order
 * `GroupUtils.coveringFor` ranks by and `OhMyRequestIndex.find` walks, so a
 * move here changes which mock a page is served.
 *
 * The list is also what says which groups exist, which is why the message
 * carries a move rather than a list — and why most of what follows is about
 * what the handler refuses.
 */
describe('OhMyGroupOrderHandler', () => {
  let records: Record<string, unknown>;
  const realChrome = StorageUtils.chrome;

  const local = (): IOhMyGroup => GroupUtils.defaultLocalFor(DOMAIN);

  const cloud = (id: string): IOhMyGroup =>
    GroupUtils.init({ id, name: id, source: 'cloud', domains: [DOMAIN] });

  /** `null` for a packet that carries no domain at all — see the last test. */
  const payload = (
    data: Partial<IOhMyGroupMove> | undefined,
    domain: string | null = DOMAIN
  ): IPacketPayload<IOhMyGroupMove, IOhMyPacketContext> =>
    ({
      type: payloadType.MOVE_GROUP,
      data,
      context: domain === null ? undefined : { domain },
      description: 'spec'
    }) as IPacketPayload<IOhMyGroupMove, IOhMyPacketContext>;

  const order = (): string[] => (records[STORAGE_KEY] as IOhMyMock).groups ?? [];

  /** Seeds the store record and the group records it lists. */
  const seed = (groups: IOhMyGroup[], listed = groups.map(g => g.id)): void => {
    records = {
      [STORAGE_KEY]: {
        type: objectTypes.STORE,
        version: '1.0.0',
        domains: [DOMAIN],
        groups: listed
      } as IOhMyMock
    };

    for (const group of groups) {
      records[group.id] = group;
    }
  };

  beforeEach(() => {
    seed([local(), cloud('anna'), cloud('bob')]);

    // Every double resolves a turn late on purpose: these tests are about what
    // happens between a read and the write that follows it.
    jest.spyOn(StorageUtils, 'get').mockImplementation(async (key = STORAGE_KEY) => {
      await tick();

      return records[key] as never;
    });
    jest.spyOn(StorageUtils, 'set').mockImplementation(async (key: string, value: unknown) => {
      await tick();
      records[key] = value;
    });
    jest.spyOn(StorageUtils, 'setStore').mockImplementation(async (value: IOhMyMock) => {
      await tick();
      records[STORAGE_KEY] = value;
    });
    jest.spyOn(StorageUtils, 'remove').mockImplementation(async (key) => {
      await tick();
      delete records[String(key)];
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

  it('puts a group directly after the one it was dropped on', async () => {
    await OhMyGroupOrderHandler.update(payload({ id: 'bob', after: local().id }));

    expect(order()).toEqual([local().id, 'bob', 'anna']);
  });

  it('puts it first when it was dropped at the top', async () => {
    await OhMyGroupOrderHandler.update(payload({ id: 'bob', after: null }));

    expect(order()).toEqual(['bob', local().id, 'anna']);
  });

  /**
   * The reason a move travels as two ids rather than as the list the drawer
   * drew. A sender that posted its list would delete the group created while it
   * was open — and `store.groups` is what makes a group exist, so its record
   * would be unreachable on the next load.
   */
  it('keeps a group created while the drag was in flight', async () => {
    const late = cloud('late');

    // Occupies the write queue, so the handler cannot possibly have read the
    // record this produced. Deliberately not awaited yet.
    const ahead = mutateStore(store => {
      records[late.id] = late;

      return { ...store, groups: [...(store.groups ?? []), late.id] };
    });
    const handled = OhMyGroupOrderHandler.update(
      payload({ id: 'bob', after: null })
    );

    await Promise.all([ahead, handled]);

    expect(order()).toEqual(['bob', local().id, 'anna', 'late']);
  });

  /**
   * The other half of the same race, and the more dangerous one: an id that is
   * no longer listed is a group that was deleted, and putting it back would let
   * it answer again.
   */
  it('refuses to move a group that has been deleted since it was drawn', async () => {
    const before = records[STORAGE_KEY];

    await OhMyGroupOrderHandler.update(payload({ id: 'gone', after: 'anna' }));

    // Identity, not contents: refusing has to mean writing nothing at all. A
    // store write wakes every content script in the browser through
    // `chrome.storage.onChanged`.
    expect(records[STORAGE_KEY]).toBe(before);
  });

  it('refuses a move whose neighbour has been deleted since it was drawn', async () => {
    const before = records[STORAGE_KEY];

    await OhMyGroupOrderHandler.update(payload({ id: 'bob', after: 'gone' }));

    expect(records[STORAGE_KEY]).toBe(before);
  });

  /**
   * The one unlisted id that may be moved. A local group's id is derived from
   * its domain, so `GroupUtils.coveringFor` draws it — sorted last — before
   * `ensureGroups` has written the record or listed it. Dragging past it has to
   * mean something, and what it means is: it is adopted where it was drawn.
   */
  it('adopts the domain own group when something is dragged below it', async () => {
    seed([cloud('anna')], ['anna']);

    await OhMyGroupOrderHandler.update(payload({ id: 'anna', after: local().id }));

    expect(order()).toEqual([local().id, 'anna']);
  });

  it('adopts it when it is the row being dragged', async () => {
    seed([cloud('anna'), cloud('bob')], ['anna', 'bob']);

    await OhMyGroupOrderHandler.update(payload({ id: local().id, after: null }));

    expect(order()).toEqual([local().id, 'anna', 'bob']);
  });

  /**
   * `ensureGroups` runs on the same write and creates the record for a local
   * group it finds missing. It used to append the id unconditionally, which
   * listed it twice — the second entry a position in the serving order that
   * nothing can ever be moved to.
   */
  it('lists the adopted group exactly once, record and all', async () => {
    seed([cloud('anna')], ['anna']);

    await OhMyGroupOrderHandler.update(payload({ id: 'anna', after: local().id }));

    expect(order()).toEqual([local().id, 'anna']);
    expect(GroupUtils.isGroup(records[local().id])).toBe(true);
  });

  /**
   * `local:<domain>` is derivable for any string, so "is it the local id" is
   * not on its own a reason to list one: a forgotten domain's group would slip
   * back in, and `ensureGroups` prunes only the ones it can read a record for.
   */
  it('does not adopt the local group of a domain the store no longer lists', async () => {
    seed([cloud('anna')], ['anna']);
    records[STORAGE_KEY] = { ...(records[STORAGE_KEY] as IOhMyMock), domains: [] };

    await OhMyGroupOrderHandler.update(
      payload({ id: 'anna', after: GroupUtils.localIdFor('forgotten.example') },
        'forgotten.example')
    );

    expect(order()).toEqual(['anna']);
  });

  it('writes nothing when the group is dropped where it already was', async () => {
    const before = records[STORAGE_KEY];

    expect(
      await OhMyGroupOrderHandler.update(payload({ id: 'anna', after: local().id }))
    ).toBe(before);
    expect(records[STORAGE_KEY]).toBe(before);
  });

  /**
   * `null` means "to the top" and `undefined` means a sender that left the
   * field out. Treating them alike promotes a group to first place on a
   * malformed message.
   */
  it('writes nothing for a move that says nothing about where', async () => {
    const before = records[STORAGE_KEY];

    expect(await OhMyGroupOrderHandler.update(payload({ id: 'bob' }))).toBeUndefined();
    expect(await OhMyGroupOrderHandler.update(payload(undefined))).toBeUndefined();
    // And one with no domain: the local id it might have adopted is derived
    // from it, so there is nothing to judge an unlisted id against.
    expect(
      await OhMyGroupOrderHandler.update(payload({ id: 'bob', after: null }, null))
    ).toBeUndefined();
    expect(records[STORAGE_KEY]).toBe(before);
  });
});
