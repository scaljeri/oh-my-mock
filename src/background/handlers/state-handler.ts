import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IOhMyMock, IState } from "../../shared/type";
import { update } from "../../shared/utils/partial-updater";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";

export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IState | IData | unknown, IOhMyPacketContext>): Promise<IState> {
    try {
      const { data, context } = payload;

      let state = data as IState || StateUtils.init({ domain: context.domain });

      if (context?.path) {
        state = await OhMyStateHandler.StorageUtils.get<IState>(context.domain) || StateUtils.init({ domain: context.domain });
        state = update<IState>(context.path, state, context.propertyName, data);

        // if (context.path.includes('$.data')) {
        //   if (state.data && !Object.keys(state.data).find(id => (data as IData).id === id)) {
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
