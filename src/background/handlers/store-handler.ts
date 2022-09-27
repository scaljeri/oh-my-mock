import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { update } from "../../shared/utils/partial-updater";
import { STORAGE_KEY } from "../../shared/constants";
import { IOhMyMock } from "../../shared/type";
import { StorageUtils } from "../../shared/utils/storage";

export class OhMyStoreHandler {
  static StorageUtils = StorageUtils;

  static async update({ data, context }: IPacketPayload<IOhMyMock | boolean, IOhMyPacketContext>): Promise<IOhMyMock | void> {
    let store = data as IOhMyMock;

    if (data === undefined) {
      return;
    }

    try {
      if (context?.path) {
        store = await OhMyStoreHandler.StorageUtils.get<IOhMyMock>(STORAGE_KEY);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        store = update<IOhMyMock>(context.path, store, context.propertyName!, data);
      } else if (context?.propertyName) {
        throw new Error('Cannot update property without path');
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return OhMyStoreHandler.StorageUtils.setStore(store!).then(() => store);
    } catch (err) {
      OhMyStoreHandler.logError(store, context, err);
    }
  }

  static logError(store: IOhMyMock, context: IOhMyPacketContext | undefined, err: Error): void {
    // eslint-disable-next-line no-console
    console.log('Could not update Store', store, context, err)
  }
}
