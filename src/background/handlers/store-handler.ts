import { IPacketPayload } from "../../shared/packet-type";
import { update } from "../../shared/utils/partial-updater";
import { STORAGE_KEY } from "../../shared/constants";
import { IOhMyMock } from "../../shared/type";
import { StorageUtils } from "../../shared/utils/storage";
import { IOhMyContext, IOhMyPropertyContext } from "../../shared/types/context";

export class OhMyStoreHandler {
  static StorageUtils = StorageUtils;

  static async update({ data, context }: IPacketPayload<IOhMyMock | IOhMyMock[keyof IOhMyMock], IOhMyPropertyContext>): Promise<IOhMyMock | void> {
    let store = data as IOhMyMock;

    if (data === undefined) {
      return; // Nothing todo
    }

    try { // If `path` is set, `data` !== IOhMyMock, but just a property value
      if (context && context.path) {
        const value = data as IOhMyMock[keyof IOhMyMock];
        store = await OhMyStoreHandler.StorageUtils.get<IOhMyMock>(STORAGE_KEY);
        store = update<IOhMyMock>(context.path, store, context.propertyName, value);
      } else if (context?.propertyName) {
        throw new Error('Cannot update property without path');
      }

      return OhMyStoreHandler.StorageUtils.setStore(store).then(() => store);
    } catch (err) {
      OhMyStoreHandler.logError(store, context, err);
    }
  }

  static logError(store: IOhMyMock, context: IOhMyContext | undefined, err: Error): void {
    // eslint-disable-next-line no-console
    console.log('Could not update Store', store, context, err)
  }
}
