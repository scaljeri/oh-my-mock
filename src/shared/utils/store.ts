import { IOhMyMock, IState, ohMyDataId, ohMyDomain, ohMyMockId, origin } from '../type';
import { StorageUtils } from './storage';
import { StateUtils } from './state';
import { STORAGE_KEY } from '@shared/constants';
import { DataUtils } from './data';

export class StoreUtils {
  static StorageUtils = StorageUtils;
  static StateUtils = StateUtils;
  static DataUtils = DataUtils;

  static clone(store: IOhMyMock): IOhMyMock {
    const domains = [...store.domains];
    const content = { mocks: { ...store.content.mocks }, states: { ...store.content.states } };

    return { ...store, content, domains };
  }

  static init(state?: IState, origin: origin = 'local'): IOhMyMock {
    const store = { domains: [], version: '', origin, content: { states: { }, mocks: { } } } as IOhMyMock;

    if (state) {
      store.domains.push(state.domain);
      // store.content.states[domain] = await this.getState(store, domain);
      store.content.states[state.domain] = state
      // await this.persistStore(store);
    }

    return store;
  }

  static getState(store: IOhMyMock, domain: ohMyDomain): IState | null {
    return store.content.states[domain];

    // if (!state) {
    // state = await this.StorageUtils.get(domain);
    // }

    // if (!state && initIfEmpty) {
    // state = this.StateUtils.init({ domain });
    //
    // await this.StorageUtils.set(STORAGE_KEY, store);
    // await this.StorageUtils.set(domain, state)
    // }
    // return state;
  }

  // static async getState(store: IOhMyMock, domain: ohMyDomain): Promise<IState | null> {
  //   return store.content.domains[domain] || await this.getDomain(store, domain);
  // }

  static isStateLoaded(store: IOhMyMock, domain: ohMyDomain): boolean {
    return !!store.content.states[domain];
  }

  static removeState(store: IOhMyMock, domain: ohMyDomain): IOhMyMock {
    const state = this.getState(store, domain);
    const domains = [...store.domains];

    if (state) {
      Object.keys(state.data)
        .forEach(async (dataId) => store = await this.removeData(store, dataId, domain));

      delete store.content.states[domain];
      // await this.StorageUtils.reset(domain);
    }

    domains.splice(domains.indexOf(domain), 1);
    return { ...store, domains };
  }

  static removeData(store: IOhMyMock, state: IState, dataId: ohMyDataId): IOhMyMock {
    const data = state.data[dataId];
    state = this.StateUtils.removeData(state, dataId);

    store = this.removeMocks(store, Object.keys(data.mocks));

    // await this.StorageUtils.reset(domain);

    // const domains = { ...clone.content.states, [domain]: state };
    // const content = { ...store.content, domains };

    return store; // { ...store, content };
  }

  static removeMocks(store: IOhMyMock, mocks: ohMyMockId[] | ohMyMockId): IOhMyMock {
    const clone = { ...store, content: { ...store.content, mocks: { ...store.content.mocks } } };

    // TODO: remove mock from data....

    (Array.isArray(mocks) ? mocks : [mocks]).forEach(async (acc, mockId) => {
      delete clone.content.mocks[mockId];
      // await this.StorageUtils.remove(mockId);
    });

    return clone;
  }

  static removeDomain(store: IOhMyMock, domain: ohMyDomain): IOhMyMock {
    const index = store.domains.indexOf(domain);
    if ( index >= 0) {
      store.domains = [...store.domains.slice(0, index), ...store.domains.slice(index + 1)];
    }

    return store;
  }

  static removeMock(store: IOhMyMock, domain: ohMyDomain, mockId: ohMyMockId, dataId: ohMyDataId): IOhMyMock {
    const content = { states: { ...store.content.states }, mocks: { ...store.content.mocks } };
    delete content.mocks[mockId];

    const state = { ...content.states[domain], data: { ...content.states[domain].data } };
    state.data[dataId] = StoreUtils.DataUtils.removeMock(state.data[dataId], mockId)
    content.states[domain] = state;

    return { ...store, content };
  }

  static async reset(store?: IOhMyMock, domain?: string): Promise<IOhMyMock> {
    if (domain) {
      if (!store.domains.indexOf(domain)) {
        store.domains.push(domain);
      }

      store.content = { ...store.content, states: { ...store.content.states, [domain]: this.StateUtils.init({ domain }) }};
    } else {
      store = this.init();
    }

    return store;
  }

  static async persistStore(store: IOhMyMock): Promise<void> {
    const clone = { ...store };
    delete clone.content;

    await this.StorageUtils.set(STORAGE_KEY, clone);
  }
}
