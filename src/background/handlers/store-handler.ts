import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { update } from "../../shared/utils/partial-updater";
import { STORAGE_KEY } from "../../shared/constants";
import { IOhMyMock } from "../../shared/type";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";
import { error } from "../utils";

export class OhMyStoreHandler {
  static StorageUtils = StorageUtils;

  static async update({ data, context }: IPacketPayload<IOhMyMock, IOhMyPacketContext>): Promise<IOhMyMock | undefined> {
    if (!data) {
      return undefined;
    }

    let store: IOhMyMock = data;

    try {
      if (context?.kind === 'patch') {
        store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY) ?? StoreUtils.init();
        store = update<IOhMyMock>(context.path, store, context.propertyName, data);
      }

      return StorageUtils.setStore(store).then(() => store);
    } catch (err) {
      error('Could not update the store', err);

      return undefined;
    }
  }
}
