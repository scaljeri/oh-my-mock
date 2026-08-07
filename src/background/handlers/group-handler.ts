import { appSources, payloadType } from '../../shared/constants';
import { IOhMyPacketContext, IPacketPayload } from '../../shared/packet-type';
import {
  IData,
  IOhMyGroup,
  IOhMyGroupUpdate,
  IState,
  ohMyDomain,
  ohMyGroupId
} from '../../shared/type';
import { GroupUtils } from '../../shared/utils/group';
import { OhMyQueue } from '../../shared/utils/queue';
import { StorageUtils } from '../../shared/utils/storage';
import { timestamp } from '../../shared/utils/timestamp';
import { mutateStore } from '../store-writer';
import { error, warn } from '../utils';

/**
 * Creating, renaming and deleting mock groups — the drawer's side of
 * `docs/architecture/mock-groups.md`.
 *
 * A group lives in two places: its own record, and its id in
 * `IOhMyMock.groups`. **Being listed there is what makes it exist** — every
 * reader takes its group ids from that list, so an unlisted record cannot even
 * be fetched on a fresh load. So creating is two writes and deleting is two
 * deletes, and neither half is optional.
 *
 * The two are done in the order that makes a half-finished change harmless.
 * Creating writes the record *first*: a record nobody lists reads as deleted,
 * and `ensureGroups` adopts it into the list next time it scans. Deleting
 * removes the record *first*, for the mirror reason — a listed id whose record
 * is gone reads as nothing at all, which is exactly what a group being deleted
 * should read as. Doing either the other way round leaves the store naming a
 * group that is not there, or storage holding one that comes back.
 *
 * The list itself is only ever touched through `mutateStore`. The popup cannot
 * be handed that job: it would have to say what the whole list is, and the list
 * it read is already out of date — `ensureGroups` and every content script
 * registering a domain add to it.
 */
export class OhMyGroupHandler {
  static StorageUtils = StorageUtils;
  static queue: OhMyQueue;

  static async update(
    { data, context }: IPacketPayload<IOhMyGroupUpdate, IOhMyPacketContext>
  ): Promise<IOhMyGroup | undefined> {
    if (!data?.group) {
      error('Cannot change a group without one', data);

      return undefined;
    }

    try {
      if (data.remove) {
        return await OhMyGroupHandler.remove(data.group.id);
      }

      return data.group.id
        ? await OhMyGroupHandler.rename(data.group.id, data.group.name)
        : await OhMyGroupHandler.create(data.group, context?.domain);
    } catch (err) {
      error(`Could not change group ${data.group.id ?? '(new)'}`, err);

      return undefined;
    }
  }

  /**
   * A new, empty group covering one domain.
   *
   * `source` is `local`, and stays `local`: a group made here holds mocks in
   * this browser's own storage. A `server` group is the SDK and a `cloud` group
   * is pulled, and neither is something a name in a text field brings into
   * being — see the sources section of the design.
   *
   * Its id is generated rather than derived, which is what keeps it distinct
   * from the domain's own group. `GroupUtils.localFor` matches on the derived
   * id for precisely this reason: both are `local` and both cover this domain,
   * so anything looking for "the domain's own" by source would find whichever
   * of the two storage handed back first.
   */
  static async create(
    update: Partial<IOhMyGroup>,
    domain?: ohMyDomain
  ): Promise<IOhMyGroup | undefined> {
    const name = update.name?.trim();
    const domains = update.domains?.length
      ? update.domains
      : domain
        ? [domain]
        : [];

    if (!name) {
      error('Cannot create a group without a name', update);

      return undefined;
    }

    if (!domains.length) {
      error('Cannot create a group that covers no domain', update);

      return undefined;
    }

    const group = GroupUtils.init({ name, source: 'local', domains });

    await OhMyGroupHandler.StorageUtils.set(group.id, group);
    await mutateStore(store => ({
      ...store,
      groups: [...(store.groups ?? []), group.id]
    }));

    return group;
  }

  /**
   * Gives a group a new name, and nothing else.
   *
   * The domain's own group may be renamed like any other. Its *record* exists
   * for that — the id is derived, so nothing about which group it is depends on
   * what it is called, and "My mocks" is only the name it starts with. What
   * cannot happen to it is deletion; see below.
   */
  static async rename(
    id: ohMyGroupId,
    name?: string
  ): Promise<IOhMyGroup | undefined> {
    const trimmed = name?.trim();

    if (!trimmed) {
      error(`Cannot rename group ${id} to nothing`);

      return undefined;
    }

    const stored = await OhMyGroupHandler.StorageUtils.get<IOhMyGroup>(id);

    if (!GroupUtils.isGroup(stored)) {
      error(`Cannot rename group ${id}: there is no such record`);

      return undefined;
    }

    const group: IOhMyGroup = {
      ...stored,
      name: trimmed,
      modifiedOn: timestamp()
    };

    await OhMyGroupHandler.StorageUtils.set(group.id, group);

    return group;
  }

  /**
   * Deletes a group, **and the requests tagged with it**.
   *
   * That second half is the whole decision. A request tagged with a group that
   * is gone is served by nobody (`GroupUtils.isActive`), drawn by nobody and
   * counted by nobody — so leaving the records behind would not be "keeping the
   * mocks", it would be losing them somewhere they can never be found again,
   * while `IState.requests` goes on naming them for ever.
   *
   * The alternative considered was re-tagging them to the domain's own group.
   * It is rejected because it is a merge, and this design merges nothing: two
   * sets kept apart precisely because their urls are regexes that cannot be
   * compared would end up in one, where `StateUtils.findRequest` answers with
   * the first match and so picks between duplicates arbitrarily — the same trap
   * `importJSON` has with imports run twice.
   *
   * So the mocks go with the group, and the drawer says how many before it
   * happens. Untagged requests are never touched: they belong to the domain's
   * own group, and that one cannot be deleted.
   */
  static async remove(id?: ohMyGroupId): Promise<undefined> {
    if (!id) {
      error('Cannot remove a group without an id');

      return undefined;
    }

    const stored = await OhMyGroupHandler.StorageUtils.get<IOhMyGroup>(id);

    if (GroupUtils.isGroup(stored)) {
      if (OhMyGroupHandler.isOwnGroupOfADomain(stored)) {
        // Not a failure to report to the user twice over — the drawer refuses
        // it before the message is ever sent. This is the backstop, and it says
        // so out loud because anything reaching it means something is sending
        // group messages the drawer does not.
        error(
          `Refusing to delete group ${id}: it is the domain's own group, ` +
          'which exists by virtue of the domain and goes when the domain does'
        );

        return undefined;
      }

      for (const domain of stored.domains) {
        await OhMyGroupHandler.purge(stored, domain);
      }

      await OhMyGroupHandler.StorageUtils.remove(id);
    } else {
      // The list names it, storage does not. Nothing reads it either way, but
      // the entry has to go or the list keeps a name for a record that will
      // never come back — and every `getMany` over the list keeps asking for
      // it. Said out loud: this is evidence of an interrupted delete.
      warn(`Group ${id} is being deleted but its record is already gone`);
    }

    await mutateStore(store => (store.groups ?? []).includes(id)
      ? { ...store, groups: (store.groups ?? []).filter(g => g !== id) }
      : undefined);

    return undefined;
  }

  /**
   * Whether this is some domain's own group, the one an untagged request
   * belongs to.
   *
   * By its id rather than by `source === 'local'`: a group made from the drawer
   * is local too, and deleting one of those has to work. The derived id is what
   * makes a group the domain's own.
   */
  static isOwnGroupOfADomain(group: IOhMyGroup): boolean {
    return group.domains.some(domain => GroupUtils.localIdFor(domain) === group.id);
  }

  /**
   * Removes one domain's traces of a group: the requests tagged with it, and
   * its entry in the domain's switched-off list.
   *
   * The requests are their own records and so are their mocks, so this is a
   * delete per record — the same walk `OhMyRemoveHandler` does for a single
   * request. A request whose record has already vanished cannot be examined
   * for a tag and so is left listed; that is the pre-existing orphan case, not
   * one this creates.
   */
  private static async purge(group: IOhMyGroup, domain: ohMyDomain): Promise<void> {
    const state = await OhMyGroupHandler.StorageUtils.get<IState>(domain);

    if (!state) {
      return;
    }

    const listed = state.requests ?? [];
    const records = await OhMyGroupHandler.StorageUtils.getMany<IData>([...listed]);
    const doomed = Object.values(records).filter(r => r?.groupId === group.id);

    for (const request of doomed) {
      for (const mockId of Object.keys(request.mocks ?? {})) {
        await OhMyGroupHandler.StorageUtils.remove(mockId);
      }

      await OhMyGroupHandler.StorageUtils.remove(request.id);
    }

    if (doomed.length) {
      const gone = new Set(doomed.map(r => r.id));

      await OhMyGroupHandler.patchState(
        domain,
        '$',
        'requests',
        listed.filter(requestId => !gone.has(requestId))
      );
    }

    const disabled = state.aux?.disabledGroups ?? [];

    // The exception outlives the group it excepts otherwise. Harmless to every
    // reader — an id no group has cannot switch anything off — but it is a list
    // that only ever grows, one entry per group ever switched off and deleted.
    if (disabled.includes(group.id)) {
      await OhMyGroupHandler.patchState(
        domain,
        '$.aux',
        'disabledGroups',
        disabled.filter(g => g !== group.id)
      );
    }
  }

  /**
   * Writes one field of a domain state, through the state handler's own lane.
   *
   * Not written directly, for the reason the cookie handler does the same: a
   * state is rewritten by every intercepted request, and a whole-record write
   * from here would land on top of one of those. A patch re-reads the record
   * inside that lane, so only the named field moves.
   *
   * Awaited, so the group record is not removed until the requests naming it
   * have actually left the state. The lanes are independent — `next` tracks
   * `isActive` per packet type — so waiting on the state lane from the group
   * lane cannot deadlock.
   */
  private static patchState(
    domain: ohMyDomain,
    path: string,
    propertyName: string,
    data: unknown
  ): Promise<IState> {
    const payload: IPacketPayload<unknown, IOhMyPacketContext> = {
      type: payloadType.STATE,
      data,
      context: { kind: 'patch', path, propertyName, domain },
      description: `background;group-handler;${propertyName}`
    };

    return new Promise<IState>(resolve =>
      OhMyGroupHandler.queue.addPacket(
        payloadType.STATE,
        { source: appSources.BACKGROUND, payload },
        state => resolve(state as IState)
      ));
  }
}
