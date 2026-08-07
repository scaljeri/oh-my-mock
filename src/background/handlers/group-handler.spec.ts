import { objectTypes, payloadType, STORAGE_KEY } from '../../shared/constants';
import { IOhMyPacketContext, IOhMyPatchContext, IPacket, IPacketPayload } from '../../shared/packet-type';
import { IData, IOhMyGroup, IOhMyGroupUpdate, IOhMyMock, IState } from '../../shared/type';
import { GroupUtils } from '../../shared/utils/group';
import { OhMyQueue } from '../../shared/utils/queue';
import { StorageUtils } from '../../shared/utils/storage';
import { OhMyGroupHandler } from './group-handler';

const DOMAIN = 'example.com';
const OWN = GroupUtils.localIdFor(DOMAIN);

const payload = (
  data: IOhMyGroupUpdate,
  domain = DOMAIN
): IPacketPayload<IOhMyGroupUpdate, IOhMyPacketContext> =>
  ({ type: payloadType.GROUP, data, context: { domain }, description: 'spec' });

const state = (over: Partial<IState> = {}): IState => ({
  version: '1.0.0',
  type: objectTypes.STATE,
  domain: DOMAIN,
  aux: {},
  requests: [],
  presets: { default: 'Default' },
  context: { domain: DOMAIN, preset: 'default' },
  ...over
} as IState);

const request = (over: Partial<IData> = {}): IData =>
  ({ id: 'r1', type: objectTypes.REQUEST, mocks: {}, ...over }) as IData;

/**
 * The handler is exercised against the real `mutateStore`, not a double.
 *
 * Half of what it has to get right is the *store list* — a group exists by
 * being named in `IOhMyMock.groups`, and that list is written by one place
 * only. A stubbed `mutateStore` would let a create that never lists the group,
 * or a delete that never unlists it, pass: both leave a correct-looking record
 * behind and both are invisible to every reader.
 */
describe('OhMyGroupHandler', () => {
  let records: Record<string, unknown>;
  let patches: IPacketPayload<unknown, IOhMyPatchContext>[];
  const realChrome = StorageUtils.chrome;

  const store = (): IOhMyMock => records[STORAGE_KEY] as IOhMyMock;
  const groups = (): string[] => store().groups ?? [];

  beforeEach(() => {
    patches = [];
    records = {
      [STORAGE_KEY]: {
        type: objectTypes.STORE,
        version: '1.0.0',
        domains: [DOMAIN],
        groups: [OWN]
      } as IOhMyMock,
      [DOMAIN]: state(),
      [OWN]: GroupUtils.defaultLocalFor(DOMAIN)
    };

    jest.spyOn(StorageUtils, 'get')
      .mockImplementation(async (key = STORAGE_KEY) => records[key] as never);
    jest.spyOn(StorageUtils, 'set')
      .mockImplementation(async (key: string, value: unknown) => { records[key] = value; });
    jest.spyOn(StorageUtils, 'setStore')
      .mockImplementation(async (value: IOhMyMock) => { records[STORAGE_KEY] = value; });
    jest.spyOn(StorageUtils, 'getMany').mockImplementation(async (keys: string[]) =>
      Object.fromEntries(keys.filter(k => k in records).map(k => [k, records[k]])) as never);
    jest.spyOn(StorageUtils, 'remove').mockImplementation(async (key) => {
      for (const k of ([] as (string | number)[]).concat(key)) {
        delete records[k];
      }

      return [];
    });

    // `ensureGroups` runs inside every `mutateStore` and reads the whole of
    // storage when a domain turns out to have no group of its own.
    StorageUtils.chrome = {
      storage: {
        local: { get: jest.fn(async (keys: unknown) => (keys === null ? { ...records } : {})) }
      }
    } as unknown as typeof StorageUtils.chrome;

    // The state lane, which the handler patches through rather than writing the
    // record itself. It answers, because the handler waits for it.
    OhMyGroupHandler.queue = {
      addPacket: jest.fn((
        _type: unknown,
        packet: IPacket<unknown, IOhMyPatchContext>,
        callback?: (result?: unknown) => void
      ) => {
        patches.push(packet.payload);
        callback?.(undefined);

        return Promise.resolve();
      })
    } as unknown as OhMyQueue;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    StorageUtils.chrome = realChrome;
  });

  const patchFor = (propertyName: string) =>
    patches.find(p => p.context?.propertyName === propertyName);

  describe('creating', () => {
    it('writes the record and lists it, which is what makes it exist', async () => {
      const created = await OhMyGroupHandler.update(payload({ group: { name: 'Payments' } }));

      expect(created?.name).toBe('Payments');
      expect(created?.type).toBe(objectTypes.GROUP);
      expect(created?.domains).toEqual([DOMAIN]);
      expect(created?.source).toBe('local');
      // Both halves. A record nobody lists cannot be fetched on a fresh load,
      // so listing it is not bookkeeping — it is the group coming into being.
      expect(records[created?.id as string]).toEqual(created);
      expect(groups()).toContain(created?.id);
    });

    /**
     * The new group is `local` and covers this domain, exactly like the
     * domain's own — so anything that answers "which is the domain's own" by
     * source rather than by the derived id would now have two candidates and
     * pick whichever storage handed back first. Every untagged request of the
     * domain is counted and served through that answer.
     */
    it('does not become the domain own group', async () => {
      const created = await OhMyGroupHandler.update(payload({ group: { name: 'Payments' } }));
      const known = [
        records[created?.id as string] as IOhMyGroup,
        records[OWN] as IOhMyGroup
      ];

      expect(created?.id).not.toBe(OWN);
      expect(GroupUtils.localFor(known, DOMAIN)?.id).toBe(OWN);
      expect(GroupUtils.localFor(known.reverse(), DOMAIN)?.id).toBe(OWN);
    });

    it('refuses a nameless group rather than making an unnameable row', async () => {
      expect(await OhMyGroupHandler.update(payload({ group: { name: '   ' } }))).toBeUndefined();
      expect(groups()).toEqual([OWN]);
    });

    it('refuses a group that covers no domain', async () => {
      expect(await OhMyGroupHandler.update(payload({ group: { name: 'X' }, }, ''))).toBeUndefined();
      expect(groups()).toEqual([OWN]);
    });
  });

  describe('renaming', () => {
    it('changes the name and nothing else', async () => {
      const created = await OhMyGroupHandler.create({ name: 'Payments' }, DOMAIN);

      const renamed = await OhMyGroupHandler.update(
        payload({ group: { id: created?.id, name: 'Billing' } }));

      expect(renamed?.name).toBe('Billing');
      expect(renamed?.id).toBe(created?.id);
      expect(renamed?.domains).toEqual([DOMAIN]);
      expect(groups()).toContain(created?.id);
    });

    /**
     * The domain's own group is renameable, and its record exists for exactly
     * that (see `GroupUtils.localIdFor`). Its identity is the derived id, so
     * "My mocks" is only where the name starts — nothing about which group it
     * is depends on what it is called.
     */
    it('renames the domain own group without unseating it', async () => {
      const renamed = await OhMyGroupHandler.update(
        payload({ group: { id: OWN, name: 'Staging fixtures' } }));

      expect(renamed?.name).toBe('Staging fixtures');
      expect(renamed?.id).toBe(OWN);
      expect(GroupUtils.localFor([renamed as IOhMyGroup], DOMAIN)?.id).toBe(OWN);
    });

    it('refuses an empty name and leaves the record as it was', async () => {
      expect(await OhMyGroupHandler.update(payload({ group: { id: OWN, name: ' ' } })))
        .toBeUndefined();
      expect((records[OWN] as IOhMyGroup).name).toBe(GroupUtils.DEFAULT_LOCAL_NAME);
    });

    it('refuses to rename a group there is no record of', async () => {
      expect(await OhMyGroupHandler.update(payload({ group: { id: 'ghost', name: 'X' } })))
        .toBeUndefined();
      expect(records['ghost']).toBeUndefined();
    });
  });

  describe('deleting', () => {
    let theirs: IOhMyGroup;

    beforeEach(async () => {
      theirs = (await OhMyGroupHandler.create({ name: 'Payments' }, DOMAIN)) as IOhMyGroup;
      records[DOMAIN] = state({ requests: ['r1', 'r2'] });
      records['r1'] = request({ id: 'r1', groupId: theirs.id, mocks: { m1: { id: 'm1', statusCode: 200 } } });
      records['r2'] = request({ id: 'r2', mocks: { m2: { id: 'm2', statusCode: 200 } } });
      records['m1'] = { id: 'm1' };
      records['m2'] = { id: 'm2' };
    });

    it('removes the record and unlists it', async () => {
      await OhMyGroupHandler.update(payload({ group: { id: theirs.id }, remove: true }));

      expect(records[theirs.id]).toBeUndefined();
      expect(groups()).not.toContain(theirs.id);
    });

    /**
     * The decision this handler had to make. A request tagged with a group
     * that is gone is served by nobody, drawn by nobody and counted by nobody
     * — so leaving the records behind loses the mocks somewhere unreachable
     * while `IState.requests` goes on naming them. They go with the group, and
     * the drawer says how many first.
     */
    it('takes the requests tagged with it, and their responses', async () => {
      await OhMyGroupHandler.update(payload({ group: { id: theirs.id }, remove: true }));

      expect(records['r1']).toBeUndefined();
      expect(records['m1']).toBeUndefined();
      expect(patchFor('requests')?.data).toEqual(['r2']);
    });

    it('leaves the untagged requests alone — they are the domain own', async () => {
      await OhMyGroupHandler.update(payload({ group: { id: theirs.id }, remove: true }));

      expect(records['r2']).toBeDefined();
      expect(records['m2']).toBeDefined();
    });

    it('patches the request list through the state lane, not over the record', async () => {
      await OhMyGroupHandler.update(payload({ group: { id: theirs.id }, remove: true }));

      const patch = patchFor('requests');

      expect(patch?.type).toBe(payloadType.STATE);
      expect(patch?.context).toEqual(
        { kind: 'patch', path: '$', propertyName: 'requests', domain: DOMAIN });
    });

    it('scrubs the group out of the domain switched-off list', async () => {
      records[DOMAIN] = state({
        requests: [],
        aux: { disabledGroups: [theirs.id, 'other'] }
      });

      await OhMyGroupHandler.update(payload({ group: { id: theirs.id }, remove: true }));

      expect(patchFor('disabledGroups')?.data).toEqual(['other']);
    });

    /**
     * It exists by virtue of the domain: the id is derived, so `ensureGroups`
     * writes it again on the very next store write — with every untagged mock
     * of the domain belonging nowhere in between.
     *
     * That self-healing is why the assertions here are about the *name* and the
     * *requests* rather than about the record being present. Without the
     * refusal the delete goes through and `ensureGroups` puts a group back
     * under the same derived id one line later, so "the record is there" and
     * "it is listed" are both true either way. What does not come back is what
     * the group held: the name someone gave it, and every request tagged with
     * it by hand.
     */
    it('refuses the domain own group, keeping its name and its requests', async () => {
      await OhMyGroupHandler.rename(OWN, 'Staging fixtures');
      records[DOMAIN] = state({ requests: ['r1'] });
      records['r1'] = request({ id: 'r1', groupId: OWN, mocks: {} });

      expect(await OhMyGroupHandler.update(payload({ group: { id: OWN }, remove: true })))
        .toBeUndefined();

      expect(groups()).toContain(OWN);
      expect((records[OWN] as IOhMyGroup).name).toBe('Staging fixtures');
      expect(records['r1']).toBeDefined();
      expect(patches).toEqual([]);
    });

    it('refuses a delete with no id at all', async () => {
      await OhMyGroupHandler.update(payload({ group: {}, remove: true }));

      expect(groups()).toContain(theirs.id);
    });

    /** An interrupted delete: the list still names it, storage does not. */
    it('unlists a group whose record has already gone', async () => {
      delete records[theirs.id];

      await OhMyGroupHandler.update(payload({ group: { id: theirs.id }, remove: true }));

      expect(groups()).not.toContain(theirs.id);
    });
  });
});
