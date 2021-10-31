import { IOhMyContext, IOhMyMock, IState, ohMyDomain, origin } from '../type';
import { StorageUtils } from './storage';
import { StateUtils } from './state';
import { objectTypes } from '@shared/constants';
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
    const store = { type: objectTypes.STORE, domains: [], version: this.version, origin, content: { states: {}, mocks: {} } } as IOhMyMock;

    if (context) {
      store.domains.push(context.domain);
      // store.content.states[domain] = await this.getState(store, domain);
      // store.content.states[state.domain] = state
      // await this.persistStore(store);
    }

    return store;
  }

  static setState(store: IOhMyMock, state: IState): IOhMyMock {
    if (store.domains.indexOf(state.domain) === -1) {
      store.domains = [state.domain, ...store.domains];
    }

    return store;
  }


  static removeState(store: IOhMyMock, domain: ohMyDomain): IOhMyMock {
    const domains = [...store.domains];
    domains.splice(domains.indexOf(domain), 1);

    return { ...store, domains };
  }

  static removeDomain(store: IOhMyMock, domain: ohMyDomain): IOhMyMock {
    const index = store.domains.indexOf(domain);
    if (index >= 0) {
      store.domains = [...store.domains.slice(0, index), ...store.domains.slice(index + 1)];
    }

    return store;
  }
}
