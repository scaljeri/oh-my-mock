import { IOhMyGroupMove, IOhMyPacketContext, IPacketPayload } from '../../shared/packet-type';
import { IOhMyMock, ohMyGroupId } from '../../shared/type';
import { GroupUtils } from '../../shared/utils/group';
import { mutateStore } from '../store-writer';
import { error } from '../utils';

/**
 * Moves one group in `IOhMyMock.groups`, which is the order that decides who
 * answers.
 *
 * Reordering is not cosmetic: `GroupUtils.coveringFor` ranks by position in
 * that list and `OhMyRequestIndex.find` takes the first group that has a match,
 * so moving a row changes which mock a page gets.
 *
 * The message carries a *move*, never a list — see `IOhMyGroupMove`. Applying
 * it inside `mutateStore` means it lands against the record as it stands, so a
 * group created or deleted while the drawer was open keeps its fate.
 */
export class OhMyGroupOrderHandler {
  static async update({
    data,
    context
  }: IPacketPayload<IOhMyGroupMove, IOhMyPacketContext>): Promise<IOhMyMock | undefined> {
    const id = data?.id;
    const domain = context?.domain;

    if (!id || !domain) {
      error('Cannot move a group without an id and a domain', data);

      return undefined;
    }

    // `null` is "to the top"; `undefined` is a sender that forgot the field,
    // and the two must not be the same thing — one of them silently promotes a
    // group to first place.
    const after: ohMyGroupId | null | undefined = data.after;

    if (after === undefined) {
      error('Cannot move a group without saying what it should follow', data);

      return undefined;
    }

    try {
      return await mutateStore(store => {
        const order = [...(store.groups ?? [])];
        // The one id that may be moved without being listed: the domain's own
        // local group. Its id is derived from the domain, so it exists — and
        // is drawn, and serves, sorted last — before `ensureGroups` gets round
        // to writing its record. Anything else the list does not name is a
        // group that was deleted while this drawer was open, and putting it
        // back would be exactly the resurrection `store.groups` is the
        // authority against.
        const adoptable = store.domains.includes(domain)
          ? GroupUtils.localIdFor(domain)
          : undefined;
        const known = (candidate: ohMyGroupId): boolean =>
          order.includes(candidate) || candidate === adoptable;

        if (!known(id)) {
          error(`Not moving ${id}: no such group`, order);

          return undefined;
        }

        if (after !== null && !known(after)) {
          // Refused rather than guessed. The drawer's list is stale, so any
          // position derived from it is a guess, and the popup redraws from
          // storage the moment this returns.
          error(`Not moving ${id}: it was to follow ${after}, which is gone`, order);

          return undefined;
        }

        const next = GroupUtils.moved(order, id, after);

        // `undefined` is `mutateStore`'s "write nothing". Dropping a group at
        // the spot it already occupies is an ordinary way to end a drag, and
        // writing the store for it wakes every content script in the browser
        // through `chrome.storage.onChanged`.
        if (next.length === order.length && next.every((g, i) => g === order[i])) {
          return undefined;
        }

        return { ...store, groups: next };
      });
    } catch (err) {
      error('Could not move the group', err);

      return undefined;
    }
  }
}
