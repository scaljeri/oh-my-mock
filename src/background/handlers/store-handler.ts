import { IPacketPayload } from "../../shared/packet-type";
import { update } from "../../shared/utils/partial-updater";
import { STORAGE_KEY } from "../../shared/constants";
import { IOhMyContext, IOhMyMock, IOhMyPropertyContext } from "../../shared/types";
import { StorageUtils } from "../../shared/utils/storage";
import { IOhMyHandlerConstructor, staticImplements } from "./handler";

type IOhMyInputData = IOhMyMock | IOhMyMock[keyof IOhMyMock];

@staticImplements<IOhMyHandlerConstructor<IOhMyInputData, IOhMyMock>>()
export class OhMyStoreHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IOhMyInputData, IOhMyContext>): Promise<IOhMyMock | void> {
    let store = payload.data as IOhMyMock;
    const context = payload.context as IOhMyPropertyContext;

    if (store === undefined) {
      return; // Nothing todo
    }

    try { // If `path` is set, `data` !== IOhMyMock, but just a property value
      if (context && context.path) {
        const value = payload.data as IOhMyMock[keyof IOhMyMock];
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
