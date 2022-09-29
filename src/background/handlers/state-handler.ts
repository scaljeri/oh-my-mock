import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyDomain, IOhMyMock } from "../../shared/types";
import { IOhMyPropertyContext } from "../../shared/types/context";
import { update } from "../../shared/utils/partial-updater";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";

export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IOhMyDomain | IOhMyDomain[keyof IOhMyDomain] | unknown, IOhMyPropertyContext>): Promise<IOhMyDomain | void> {
    try {
      const { data, context } = payload;
      let domain: IOhMyDomain;

      if (StateUtils.isDomain(data)) {
        domain = data;
      } else if (context) {
        if (context.path && !context.propertyName) {
          throw new Error('Found `path` without a property value');
        }

        domain = data as IOhMyDomain || StateUtils.init({ domain: context.key });
        const value = data as IOhMyDomain[keyof IOhMyDomain];

        domain = await OhMyStateHandler.StorageUtils.get<IOhMyDomain>(context.key) || StateUtils.init({ domain: context.key });
        domain = update<IOhMyDomain>(context.path, domain, context.propertyName, value);
      } else {
        throw new Error('Data and Context not defined');
      }

      // if (context.path.includes('$.data')) {
      //   if (state.data && !Object.keys(state.data).find(id => (data as IOhMyRequest).id === id)) {
      //     state.aux.filteredRequests = null;
      //   }
      // }
      // Is the state new, add it to the store
      let store = await OhMyStateHandler.StorageUtils.get<IOhMyMock>();

      if (!StoreUtils.hasState(store, domain.domain)) {
        store = StoreUtils.setState(store, domain);
      }

      await OhMyStateHandler.StorageUtils.setStore(store);

      // if (state.aux.appActive && state.aux.popupActive) {
      //   cSPRemoval([payload.context.domain]);
      // }

      return StorageUtils.set(domain.domain, domain).then(() => domain);
    } catch (err) {
      throw new Error('Somthing when wrong inside StateHandler');
    }
  }
}
