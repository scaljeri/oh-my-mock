import { IOhMyContext, IOhMyMock, IState, ohMyDomain, origin } from '../type';
import { StorageUtils } from './storage';
import { StateUtils } from './state';
import { objectTypes } from '../constants';
import { DataUtils } from './data';

export class StoreUtils {
  static version = '__OH_MY_VERSION__';
  static StorageUtils = StorageUtils;
  static StateUtils = StateUtils;
  static DataUtils = DataUtils;

  static clone(store: IOhMyMock): IOhMyMock {
    const domains = [...store.domains];

    return { ...store, domains };
  }

  static init(context?: IOhMyContext, origin: origin = 'local'): IOhMyMock {
    // Annotated rather than asserted: `domains: []` on its own infers `never[]`,
    // which is what the assertion was there to paper over.
    const store: IOhMyMock = { type: objectTypes.STORE, domains: [], version: this.version, origin };

    if (context) {
      store.domains.push(context.domain);
    }

    return store;
  }

  static hasState(store: IOhMyMock, domain: ohMyDomain): boolean {
    return store?.domains?.indexOf(domain) >= 0;
  }

  // A new record rather than the one it was given, like `removeState` below.
  // The only caller is a mutation handed to `mutateStore`, whose contract is to
  // *return* the record the store should become — editing the argument in place
  // and returning it reads as a change to a reader and as none to a writer.
  static setState(store: IOhMyMock, state: IState): IOhMyMock {
    if (StoreUtils.hasState(store, state.domain)) {
      return store;
    }

    return { ...store, domains: [state.domain, ...store.domains] };
  }


  static removeState(store: IOhMyMock, domain: ohMyDomain): IOhMyMock {
    const domains = [...store.domains];
    const index = domains.indexOf(domain);

    // `indexOf` answers -1 for a domain that is not in the list, and
    // `splice(-1, 1)` removes the *last* entry — so removing a domain twice
    // (a double-fired delete) used to silently drop an unrelated domain.
    // Removing what is not there must be a no-op.
    if (index >= 0) {
      domains.splice(index, 1);
    }

    return { ...store, domains };
  }

  // static removeDomain(store: IOhMyMock, domain: ohMyDomain): IOhMyMock {
  //   const index = store.domains.indexOf(domain);
  //   if (index >= 0) {
  //     store.domains = [...store.domains.slice(0, index), ...store.domains.slice(index + 1)];
  //   }

  //   return store;
  // }
}
