import { IOhMyPacketContext, IPacketPayload } from "../shared/packet-type";
import { IOhMyMock, IState } from "../shared/type";
import { update } from "../shared/utils/partial-updater";
import { StateUtils } from "../shared/utils/state";
import { StorageUtils } from "../shared/utils/storage";
import { StoreUtils } from "../shared/utils/store";
import { clearCSPRemoval, cSPRemoval } from "./remove-csp-header";

export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IState | unknown, IOhMyPacketContext>): Promise<IState> {
    const { data, context } = payload;

    let state = data as IState;

    if (!state) {
      return;
    }

    try {
      if (context?.path) {
        state = await OhMyStateHandler.StorageUtils.get<IState>(context.domain) || StateUtils.init({ domain: context.domain });
        state = update<IState>(context.path, state, context.propertyName, data);
      } else { // Is the state new, add it to the store
        let store = await OhMyStateHandler.StorageUtils.get<IOhMyMock>();

        if (!StoreUtils.hasState(store, state.domain)) {
          store = StoreUtils.setState(store, state);

          await OhMyStateHandler.StorageUtils.setStore(store);
        }
      }

      if (state.aux.appActive && state.aux.popupActive) {
        cSPRemoval([`http://${payload.context.domain}/*`, `https://${payload.context.domain}/*`]);
      } else {
        clearCSPRemoval(`*://${payload.context.domain}`);
      }

      return StorageUtils.set(state.domain, state).then(() => state);
    } catch (err) {
    }
  }
}
