import { IData, IOhMyMock, IState, IUpsertMock, ohMyDomain } from '../type';
import { DataUtils } from './data';
import { StateUtils } from './state';
import { StoreUtils } from './store';

export class ActionUtils {
  static StoreUtils = StoreUtils;
  static DataUtils = DataUtils;
  static StateUtils = StateUtils;

  updateStore(store: IOhMyMock, state: IState): IOhMyMock {
    if (store.domains.indexOf(state.domain) === -1) {
      store.domains = [state.domain, ...store.domains];
    }

    store.content = {
      ...store.content,
      states: { ...store.content.states, [state.domain]: state },
    };

    return store;
  }

  upsertMock(store: IOhMyMock, update: IUpsertMock, domain: ohMyDomain): IOhMyMock {
    const state = ActionUtils.StoreUtils.getState(store, domain);

    let data = ActionUtils.StateUtils.findData(state, update);

    if (!data) {
      data = ActionUtils.DataUtils.init({
        url: update.url,
        method: update.method,
        requestType: update.requestType
      });
    }

  }

  upsertData(store, update: Partial<IData>, domain: ohMyDomain): IOhMyMock {
    const state = store.content.states[domain];
    const data = ActionUtils.DataUtils.find(state, update) || ActionUtils.DataUtils.init(update);

    store.content = {
      ...store.content,
      states: {
        ...store.content.states,
        [domain]: ActionUtils.StateUtils.setData(state, data)
      }
    }

    return store;
  }
}
