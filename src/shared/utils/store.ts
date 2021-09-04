import { IOhMyMock, IState, ohMyDataId, ohMyDomain, ohMyMockId, origin } from '../type';
import { StorageUtils } from './storage';
import { StateUtils } from './state';
import { STORAGE_KEY } from '@shared/constants';

export class StoreUtils {
  static StorageUtils = StorageUtils;
  static StateUtils = StateUtils;

  static clone(store: IOhMyMock): IOhMyMock {
    const domains = [...store.domains];
    const content = { mocks: { ...store.content.mocks }, domains: { ...store.content.domains } };

    return { ...store, content, domains };
  }

  static async init(domain?: ohMyDomain, origin: origin = 'local'): Promise<IOhMyMock> {
    const store = { domains: [], version: '', origin, content: { domains: { }, mocks: { } } };

    if (domain) {
      store.domains.push(domain);
      store.content.domains[domain] = await this.getDomain(store, domain);
      await this.persistStore(store);
    }

    return store;
  }

  static async getDomain(store: IOhMyMock, domain: ohMyDomain, initIfEmpty = true): Promise<IState | null> {
    let state = store.content.domains[domain];

    if (!state) {
      state = await this.StorageUtils.get(domain);
    }

    if (!state && initIfEmpty) {
      state = this.StateUtils.init({domain});

      await this.StorageUtils.set(STORAGE_KEY, store);
      await this.StorageUtils.set(domain, state)
    }

    return state;
  }

  // static async getState(store: IOhMyMock, domain: ohMyDomain): Promise<IState | null> {
  //   return store.content.domains[domain] || await this.getDomain(store, domain);
  // }

  static async removeDomain(store: IOhMyMock, domain: ohMyDomain): Promise<IOhMyMock> {
    const state = await this.getDomain(store, domain, false);
    const domains = [...store.domains];

    if (state) {
      Object.keys(state.data)
        .forEach(async (dataId) => store = await this.removeData(store, dataId, domain));

      delete store.content.domains[domain];
      await this.StorageUtils.reset(domain);
    }

    domains.splice(domains.indexOf(domain), 1);
    return { ...store, domains };
  }

  static async removeData(store: IOhMyMock, dataId: ohMyDataId, domain: ohMyDomain): Promise<IOhMyMock> {
    const state = await this.StateUtils.removeData(await this.getDomain(store, domain, false), dataId);

    const data = store.content.domains[domain].data[dataId];
    const clone = await this.removeMocks(store, Object.keys(data.mocks));

    await this.StorageUtils.reset(domain);

    const domains = { ...clone.content.domains, [domain]: state };
    const content = { ...store.content, domains };

    return { ...store, content };
  }

  static async reset(store?: IOhMyMock, domain?: string): Promise<IOhMyMock> {
    if (domain) {
      store = await this.removeDomain(store, domain);
      store.domains.push(domain);
      store.content.domains[domain] = this.StateUtils.init({ domain });
    } else {
      store = await this.init();
      this.StorageUtils.reset();
    }

    return store;
  }

  static async removeMocks(store: IOhMyMock, mocks: ohMyMockId[] | ohMyMockId): Promise<IOhMyMock> {
    const clone = { ...store, content: { ...store.content, mocks: { ...store.content.mocks } } };

    (Array.isArray(mocks) ? mocks : [mocks]).forEach(async (acc, mockId) => {
      delete clone.content.mocks[mockId];
      await this.StorageUtils.remove(mockId);
    });

    return clone;
  }

  static async persistStore(store: IOhMyMock): Promise<void> {
    const clone = { ...store };
    delete clone.content;

    await this.StorageUtils.set(STORAGE_KEY, clone);
  }
}
