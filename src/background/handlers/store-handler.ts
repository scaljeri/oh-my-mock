import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { update } from "../../shared/utils/partial-updater";
import { IOhMyMock } from "../../shared/types/store";
import { mutateStore } from "../store-writer";
import { error } from "../utils";

export class OhMyStoreHandler {
  static async update({ data, context }: IPacketPayload<Partial<IOhMyMock>, IOhMyPacketContext>): Promise<IOhMyMock | undefined> {
    // `data === undefined` is nothing to write; `false`, `0` and `''` are
    // values. This was `if (!data)`, which ate `deactivate()`'s
    // `patch(false, '$', 'popupActive', STORE)` — harmless only because nothing
    // in production still reads `popupActive`, and a trap for the next falsy
    // patch anyone sends.
    if (data === undefined || data === null) {
      return undefined;
    }

    try {
      if (context?.kind === 'patch') {
        // The record comes from `mutateStore`, freshly read and nobody else's,
        // so `update` may write into it.
        return await mutateStore(store =>
          update<IOhMyMock>(context.path, { ...store }, context.propertyName, data));
      }

      // Everything else is a **merge** of the fields the sender named onto the
      // record as it stands now. It used to be the record itself: the popup
      // read the whole store, spread its one change over it and sent the
      // result, which was then written verbatim. So opening the popup wrote
      // back the `domains` and `groups` of whenever the popup had last read
      // them — undoing every domain registered and every group created since.
      // Nothing over the wire can replace the store wholesale any more, which
      // is the point: a sender is not in a position to say what the fields it
      // did not touch should be.
      return await mutateStore(store => ({ ...store, ...data }));
    } catch (err) {
      error('Could not update the store', err);

      return undefined;
    }
  }
}
