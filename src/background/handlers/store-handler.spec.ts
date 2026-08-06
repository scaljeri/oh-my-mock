import { objectTypes, payloadType, STORAGE_KEY } from '../../shared/constants';
import { IOhMyPacketContext, IPacketPayload } from '../../shared/packet-type';
import { IOhMyMock, IState } from '../../shared/type';
import { GroupUtils } from '../../shared/utils/group';
import { StateUtils } from '../../shared/utils/state';
import { StorageUtils } from '../../shared/utils/storage';
import { mutateStore } from '../store-writer';
import { OhMyStateHandler } from './state-handler';
import { OhMyStoreHandler } from './store-handler';

/** A storage round trip that does not finish in the turn it started in. */
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/**
 * A `STORE` packet changes the fields it names and nothing else.
 *
 * It used to carry the whole record: the popup read the store, spread its one
 * change over it and sent the result, which was written verbatim. Marking the
 * popup open therefore wrote back the `domains` and `groups` of whenever the
 * popup had last read them — undoing every domain registered and every group
 * created since, and leaving those domains' requests and mocks in storage with
 * nothing listing them.
 */
describe('OhMyStoreHandler', () => {
  let records: Record<string, unknown>;
  const realChrome = StorageUtils.chrome;

  const payload = (
    data: unknown,
    context?: Partial<IOhMyPacketContext>
  ): IPacketPayload<Partial<IOhMyMock>, IOhMyPacketContext> =>
    ({
      type: payloadType.STORE,
      data,
      context,
      description: 'spec'
    }) as IPacketPayload<Partial<IOhMyMock>, IOhMyPacketContext>;

  const stored = (): IOhMyMock => records[STORAGE_KEY] as IOhMyMock;

  beforeEach(() => {
    const group = GroupUtils.defaultLocalFor('listed.example');

    records = {
      [STORAGE_KEY]: {
        type: objectTypes.STORE,
        version: '1.0.0',
        domains: ['listed.example'],
        groups: [group.id]
      } as IOhMyMock,
      [group.id]: group
    };

    // Every double resolves a turn late on purpose: these tests are about what
    // happens between a read and the write that follows it, and a fake that
    // answers synchronously interleaves nothing at all.
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
    jest.spyOn(StorageUtils, 'getMany').mockImplementation(async (keys: string[]) => {
      await tick();

      return Object.fromEntries(keys.filter(k => k in records).map(k => [k, records[k]])) as never;
    });

    StorageUtils.chrome = {
      storage: {
        local: {
          get: jest.fn(async (keys: unknown) => (keys === null ? { ...records } : {}))
        }
      }
    } as unknown as typeof StorageUtils.chrome;
    OhMyStateHandler.StorageUtils = StorageUtils;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    StorageUtils.chrome = realChrome;
  });

  it('changes the fields it was given and leaves the rest alone', async () => {
    await OhMyStoreHandler.update(payload({ popupActive: true }));

    expect(stored().popupActive).toBe(true);
    expect(stored().domains).toEqual(['listed.example']);
    expect(stored().groups?.length).toBe(1);
  });

  it('does not undo a domain registered while it was in flight', async () => {
    // The popup marking itself open, and a site being activated, at the same
    // time — two lanes of the queue, so nothing orders them. Whichever wrote
    // last used to be the only one that had happened.
    await Promise.all([
      OhMyStoreHandler.update(payload({ popupActive: true })),
      OhMyStateHandler.update({
        type: payloadType.STATE,
        data: StateUtils.init({ domain: 'brand-new.example' }),
        context: { domain: 'listed.example' },
        description: 'spec'
      } as IPacketPayload<IState, IOhMyPacketContext>)
    ]);

    expect(stored().popupActive).toBe(true);
    expect([...stored().domains].sort()).toEqual(['brand-new.example', 'listed.example']);
  });

  /**
   * The record the merge is built on has to be read *inside* the queue, not
   * before joining it.
   *
   * The test above happens to catch a handler that reads too early only when
   * the two lanes interleave one particular way round; force the order and it
   * passes either way. Here the chain is already occupied when the handler
   * arrives, so a read taken before joining is guaranteed to be stale — which
   * is the whole reason `mutateStore` reads for you rather than taking a
   * record you hand it.
   */
  it('merges onto the record as it stands when its turn comes, not one read earlier', async () => {
    // Occupies the queue, so the handler cannot reach storage before this has
    // written. Deliberately not awaited yet.
    const ahead = mutateStore(store => ({
      ...store,
      domains: [...store.domains, 'arrived-first.example']
    }));

    const handled = OhMyStoreHandler.update(payload({ popupActive: true }));

    await Promise.all([ahead, handled]);

    expect(stored().popupActive).toBe(true);
    expect([...stored().domains].sort()).toEqual([
      'arrived-first.example',
      'listed.example'
    ]);
  });

  it('applies a patch to the record as it stands', async () => {
    await OhMyStoreHandler.update(
      payload(true, { kind: 'patch', path: '$', propertyName: 'popupActive' })
    );

    expect(stored().popupActive).toBe(true);
    expect(stored().domains).toEqual(['listed.example']);
  });

  /**
   * `false`, `0` and `''` are values. This was `if (!data)`, which ate
   * `deactivate()`'s `patch(false, '$', 'popupActive', STORE)`.
   */
  it('patches a falsy value in rather than ignoring it', async () => {
    records[STORAGE_KEY] = { ...stored(), popupActive: true };

    await OhMyStoreHandler.update(
      payload(false, { kind: 'patch', path: '$', propertyName: 'popupActive' })
    );

    expect(stored().popupActive).toBe(false);
  });

  it('writes nothing for a packet with no data', async () => {
    const before = stored();

    expect(await OhMyStoreHandler.update(payload(undefined))).toBeUndefined();
    expect(stored()).toBe(before);
  });
});
