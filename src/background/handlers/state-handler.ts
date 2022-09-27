import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IOhMyRequest, IOhMyDomain, IOhMyMock } from "../../shared/type";
import { update } from "../../shared/utils/partial-updater";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";

export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IOhMyDomain | IOhMyRequest | unknown, IOhMyPacketContext>): Promise<IOhMyDomain | void> {
    try {
      const { data, context } = payload;

      if (!context) {
        return;
      }

      let state = data as IOhMyDomain || StateUtils.init({ domain: context.domain });

      if (context?.path) {
        if (!context.propertyName) {
          throw new Error('Found `path` without a property value');
        }

        state = await OhMyStateHandler.StorageUtils.get<IOhMyDomain>(context.domain) || StateUtils.init({ domain: context.domain });
        state = update<IOhMyDomain>(context.path, state, context.propertyName, data);

        // if (context.path.includes('$.data')) {
        //   if (state.data && !Object.keys(state.data).find(id => (data as IOhMyRequest).id === id)) {
        //     state.aux.filteredRequests = null;
        //   }
        // }
      }
      // Is the state new, add it to the store
      let store = await OhMyStateHandler.StorageUtils.get<IOhMyMock>();

      if (!StoreUtils.hasState(store, state.domain)) {
        store = StoreUtils.setState(store, state);

        await OhMyStateHandler.StorageUtils.setStore(store);
      }

      // if (state.aux.appActive && state.aux.popupActive) {
      //   cSPRemoval([payload.context.domain]);
      // }

      return StorageUtils.set(state.domain, state).then(() => state);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  }
}
