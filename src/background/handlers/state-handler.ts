import { IOhMyPacketContext, IPacketPayload } from "../../shared/packet-type";
import { IData, IOhMyMock, IState } from "../../shared/type";
import { update } from "../../shared/utils/partial-updater";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";
import { error } from "../utils";

export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IState | IData | unknown, IOhMyPacketContext>): Promise<IState | undefined> {
    try {
      const { data, context } = payload;
      // A full state carries its own domain; a patch only has the packet context.
      const domain = context?.domain ?? (data as IState)?.domain;

      if (!domain) {
        error('Cannot update a state without a domain', payload);
        return undefined;
      }

      let state = data as IState || StateUtils.init({ domain });

      if (context?.kind === 'patch') {
        state = await OhMyStateHandler.StorageUtils.get<IState>(domain) || StateUtils.init({ domain });
        state = update<IState>(context.path, state, context.propertyName, data);
      }
      // Is the state new, add it to the store
      let store = await OhMyStateHandler.StorageUtils.get<IOhMyMock>();

      if (!StoreUtils.hasState(store, domain)) {
        store = StoreUtils.setState(store, state);

        await OhMyStateHandler.StorageUtils.setStore(store);
      }

      // if (state.aux.appActive && state.aux.popupActive) {
      //   cSPRemoval([payload.context.domain]);
      // }

      return StorageUtils.set(domain, state).then(() => state);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  }
}
