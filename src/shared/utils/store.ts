import { IOhMyDomainContext, IOhMyDomain, IOhMyOrigin, IOhMyMock, IOhMyDomainId } from '../types';
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

  static init(context?: IOhMyDomainContext, origin: IOhMyOrigin = 'local'): IOhMyMock {
    const store = { type: objectTypes.STORE, domains: [], version: this.version, origin } as IOhMyMock;

    if (context) {
      store.domains.push(context.key);
    }

    return store;
  }

  static hasState(store: IOhMyMock, domain: IOhMyDomainId): boolean {
    return store?.domains?.indexOf(domain) >= 0;
  }

  static setState(store: IOhMyMock, state: IOhMyDomain): IOhMyMock {
    if (!StoreUtils.hasState(store, state.domain)) {
      store.domains = [state.domain, ...store.domains];
    }

    return store;
  }


  static removeState(store: IOhMyMock, domain: IOhMyDomainId): IOhMyMock {
    const domains = [...store.domains];
    domains.splice(domains.indexOf(domain), 1);

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
