import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { update } from "../../shared/utils/partial-updater";
import { STORAGE_KEY } from "../../shared/constants";
import { IOhMyMock } from "../../shared/types/store";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";
import { ensureGroups } from "../ensure-groups";
import { error } from "../utils";

export class OhMyStoreHandler {
  static StorageUtils = StorageUtils;

  static async update({ data, context }: IPacketPayload<IOhMyMock, IOhMyPacketContext>): Promise<IOhMyMock | undefined> {
    // `data === undefined` is nothing to write; `false`, `0` and `''` are
    // values. This was `if (!data)`, which ate `deactivate()`'s
    // `patch(false, '$', 'popupActive', STORE)` — harmless only because nothing
    // in production still reads `popupActive`, and a trap for the next falsy
    // patch anyone sends.
    if (data === undefined || data === null) {
      return undefined;
    }

    let store: IOhMyMock = data;

    try {
      if (context?.kind === 'patch') {
        store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY) ?? StoreUtils.init();
        store = update<IOhMyMock>(context.path, store, context.propertyName, data);
      }

      // Every domain the store lists needs the local group its mocks belong to.
      // Cheap once they all have one — see `ensureGroups`, which reads the
      // listed groups and stops there rather than scanning storage. Here as
      // well as in the state handler because the popup announcing itself writes
      // the store without going near a state.
      store = await ensureGroups(store);

      return StorageUtils.setStore(store).then(() => store);
    } catch (err) {
      error('Could not update the store', err);

      return undefined;
    }
  }
}
