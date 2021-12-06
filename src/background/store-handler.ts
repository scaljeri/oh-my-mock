import { IPacketPayload } from "../shared/packet-type";
import { update } from "../shared/utils/partial-updater";
import { STORAGE_KEY } from "../shared/constants";
import { IOhMyMock } from "../shared/type";
import { StorageUtils } from "../shared/utils/storage";

export class OhMyStoreHandler {
  static StorageUtils = StorageUtils;

  static async update({ data, context }: IPacketPayload<IOhMyMock>): Promise<IOhMyMock> {
    let store = data;

    if (context?.path) {
      store = await StorageUtils.get<IOhMyMock>(STORAGE_KEY);
      store = update<IOhMyMock>(context.path, store, context.propertyName, data);
    }

    return StorageUtils.setStore(store).then(() => store);
  }
}
