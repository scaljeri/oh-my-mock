import { IPacketPayload } from "../../shared/packet-type";
import { IOhMyDomain, IOhMyMock } from "../../shared/types";
import { IOhMyContext, IOhMyPropertyContext } from "../../shared/types/context";
import { update } from "../../shared/utils/partial-updater";
import { StateUtils } from "../../shared/utils/state";
import { StorageUtils } from "../../shared/utils/storage";
import { StoreUtils } from "../../shared/utils/store";
import { IOhMyHandlerConstructor, staticImplements } from "./handler";

type IOhMyInputData = IOhMyDomain | IOhMyDomain[keyof IOhMyDomain];

@staticImplements<IOhMyHandlerConstructor<IOhMyInputData, IOhMyDomain>>()
export class OhMyStateHandler {
  static StorageUtils = StorageUtils;

  static async update(payload: IPacketPayload<IOhMyInputData, IOhMyContext>): Promise<IOhMyDomain | void> {
    try {
      // const { data, context } = payload as { };
      const context = payload.context as IOhMyPropertyContext;
      let domain: IOhMyDomain;

      if (StateUtils.isDomain(payload.data)) {
        domain = payload.data || StateUtils.init({ domain: context.key });
      } else if (context) {
        if (context.path && !context.propertyName) {
          throw new Error('Found `path` without a property value');
        }

        const value = payload.data as IOhMyDomain[keyof IOhMyDomain];
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
        await OhMyStateHandler.StorageUtils.setStore(store);
      }

      await OhMyStateHandler.StorageUtils.set(context.key!, domain);


      // if (state.aux.appActive && state.aux.popupActive) {
      //   cSPRemoval([payload.context.domain]);
      // }

      return StorageUtils.set(domain.domain, domain).then(() => domain);
    } catch (err) {
      throw new Error('Somthing when wrong inside StateHandler');
    }
  }
}
