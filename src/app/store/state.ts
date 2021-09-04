import {
  State,
  Action,
  StateContext,
  Selector,
  createSelector
} from '@ngxs/store';
import { Injectable } from '@angular/core';
import {
  ChangeDomain,
  DeleteData,
  DeleteMock,
  InitState,
  LoadData,
  ResetState,
  Toggle,
  UpsertData,
  UpsertMock,
  UpsertScenarios,
  ViewChangeOrderItems,
  ViewReset
} from './actions';
import { DeleteMockStorage, UpdateMockStorage } from './storage-actions';

import {
  IData,
  IState,
  IOhMyMock,
  IOhMyViewItemsOrder,
  IOhMyToggle,
  ohMyMockId,
  ohMyDataId,
  IUpsertMock,
  ohMyScenarioId,
  ohMyDomain,
} from '@shared/type';
import { patch } from '@ngxs/store/operators';


import { STORAGE_KEY } from '@shared/constants';

import * as stateUtils from '@shared/utils/state';
import * as dataUtils from '@shared/utils/data';
import * as mockUtils from '../../shared/utils/mock';
import * as view from '@shared/utils/view';
import { StoreUtils } from '@shared/utils/store';
import { AppStateService } from '../services/app-state.service';
import { StorageService } from '../services/storage.service';
import { StateUtils } from '@shared/utils/state';
import { DataUtils } from '@shared/utils/data';
import { StorageUtils } from '@shared/utils/storage';

@State<IOhMyMock>({
  name: STORAGE_KEY,
  defaults: {
    domains: [],
    version: '',
    content: { mocks: { }, domains: { } }
  }
})
@Injectable()
export class OhMyState {
  static domain: string;
  static StorageUtils = StorageUtils;
  static StoreUtils = StoreUtils;
  static StateUtils = StateUtils;
  static DataUtils = DataUtils;

  constructor(appStateService: AppStateService, private storageService: StorageService) {
    appStateService.domain$.subscribe(domain => OhMyState.domain = domain);
  }

  @Selector()
  static mainState(store: IOhMyMock): IState {
    return store.content.domains[OhMyState.domain];
  }

  static getStore(ctx: StateContext<IOhMyMock>): IOhMyMock {
    return { ...ctx.getState()[STORAGE_KEY] };
  }

  static async getActiveState(state: IOhMyMock, domain = OhMyState.domain): Promise<IState> {
    return await this.StoreUtils.getDomain(state, domain);
  }

  static async getMyState(ctx: StateContext<IOhMyMock>, domain?: string): Promise<[IState, string]> {
    const state = this.getStore(ctx);
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...await OhMyState.getActiveState(state, domain) };

    return [domainState, activeDomain];
  }

  @Action(InitState)
  async init(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IOhMyMock, domain?: string }) {

    const activeDomain = domain || OhMyState.domain;
    const store = { ...(payload || await OhMyState.StoreUtils.init()) };

    if (!store.content.domains[activeDomain]) {
      if (store.domains.indexOf(activeDomain) === 1) {
        store.domains = [activeDomain, ...store.domains];
      }

      store.content = {
        ...store.content,
        domains: { ...store.content.domains, [activeDomain]: await OhMyState.StoreUtils.getDomain(store, activeDomain) }
      }
    }

    // TODO: Init with test data somehow

    ctx.setState(store);
  }

  @Action(ChangeDomain)
  async changeDomain(ctx: StateContext<IOhMyMock>, { payload }: { payload: ohMyDomain }) {
    OhMyState.domain = payload;
    const store = OhMyState.getStore(ctx);

    store.content = {
      ...store.content,
      domains: { ...store.content.domains, [payload]: await OhMyState.StoreUtils.getDomain(store, payload) }
    };

    if (store.domains.indexOf(payload) === -1) {
      store.domains = [payload, ...store.domains]
    }

    ctx.setState(store);
  }

  @Action(ResetState)
  async reset(ctx: StateContext<IOhMyMock>, { payload }: { payload: ohMyDomain }) {
    const store = await OhMyState.StoreUtils.reset(OhMyState.getStore(ctx), payload);

    ctx.setState(store);
  }

  // @Action(LoadData)
  // async loadData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: ohMyDataId, domain?: string }) {
  //   const store = OhMyState.getState(ctx);

  //   const [state, activeDomain] = await OhMyState.getMyState(ctx, domain);
  //   const mocks = { ...store.mocks };

  //   Object.keys(state.data[payload].mocks).forEach(async (id: ohMyMockId) => {
  //     mocks[id] ??= await mockUtils.get(store, id);
  //   });

  //   ctx.setState(patch({ mocks }))
  // }


  @Action(UpsertMock)
  @Action(UpdateMockStorage)
  async upsertMock(ctx: StateContext<IOhMyMock>, action: UpsertMock | UpdateMockStorage) {
    const { payload, domain } = action;
    //{ payload, domain }: { payload: IUpsertMock, domain?: string }) {
    const store = OhMyState.getStore(ctx);

    let [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    let data = OhMyState.DataUtils.find(state, payload);

    if (!data) {
      data = OhMyState.DataUtils.init({
        url: payload.url,
        method: payload.method,
        requestType: payload.requestType
      });
    }

    state = OhMyState.StateUtils.setData(state, data);

    if (action instanceof UpdateMockStorage) {
      await OhMyState.StorageUtils.set(activeDomain, state);
    }

    store.content = {
      ...store.content,
      domains: { ...store.content.domains, [activeDomain]: state }
    };

    ctx.setState(store);
  }

  @Action(UpsertData)
  async upsertData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: Partial<IData>, domain?: string }) {
    const store = OhMyState.getStore(ctx);
    let [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    const data = OhMyState.DataUtils.find(state, payload) || OhMyState.DataUtils.init(payload);
    state = OhMyState.StateUtils.setData(state, data);

    // if (!payload.id) {
    //   state.views = Object.entries(state.views).reduce((acc, [k, v]) => {
    //     acc[k] = [data.id, ...v];

    //     return acc;
    //   }, { });
    // }

    store.content = {
      ...store.content,
      domains: { ...store.content.domains, [activeDomain]: state }
    };

    ctx.setState(store);
  }

  @Action(UpsertScenarios)
  async upsertScenarios(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: Record<ohMyScenarioId, string>, domain?: string }) {
    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    // TODO: check for duplicate name values (replace old one???)
    state.scenarios = { ...state.scenarios, ...payload };

    const domains = { ...store.domains, [activeDomain]: state };
    ctx.setState({ ...store, domains });
  }

  @Action(DeleteMock)
  @Action(DeleteMockStorage)
  async deleteMock(ctx: StateContext<IOhMyMock>, action: { payload: { id: ohMyDataId, mockId: ohMyMockId }, domain?: string }) {
    const { payload, domain } = action;
    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    const data = OhMyState.DataUtils.get(state, payload.id);
    delete data.mocks[payload.mockId];

    if (action instanceof DeleteMock) {
      // TODO
    }

    state.data = { ...state.data, [data.id]: data };
    const domains = { ...store.domains, [activeDomain]: state };

    ctx.setState({ ...store, domains });
  }

  @Action(DeleteData)
  async deleteData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: ohMyDataId, domain?: string }) {
    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    state.views = Object.entries(state.views).reduce((acc, [k, v]) => {
      acc[k] = view.remove(v, payload);
      return acc;
    }, { });

    const domains = { ...store.domains, [activeDomain]: state };
    ctx.setState({ ...store, domains });
  }

  @Action(ViewChangeOrderItems)
  async viewChangeOrderOfItems(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyViewItemsOrder }) {
    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await OhMyState.getMyState(ctx);

    const id = state.views[payload.name][payload.id];
    state.views = { ...state.views, [payload.name]: view.move(state.views[payload.name], id, payload.to) };

    const domains = { ...store.domains, [activeDomain]: state };

    ctx.setState({ ...store, domains });
  }

  @Action(Toggle)
  async toggle(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyToggle }) {
    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await OhMyState.getMyState(ctx);

    state.toggles = { ...state.toggles, [payload.name]: payload.value };

    const domains = { ...store.domains, [activeDomain]: state };
    ctx.setState({ ...store, domains });
  }

  @Action(ViewReset)
  async viewReset(ctx: StateContext<IOhMyMock>, { payload }: { payload: string }) {
    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await OhMyState.getMyState(ctx);

    state.views = { ...state.views, [payload]: Object.keys(state.data) };

    const domains = { ...store.domains, [activeDomain]: state };
    ctx.setState({ ...store, domains });
  }

  // static findData(
  //   state: IState,
  //   context: IOhMyContext
  // ): { index: number; data: IData } {
  //   const data = findMocks(state, context);
  //   const index = !data ? -1 : state.data.indexOf(data);

  //   if (index >= 0) {
  //     return { index: state.data.indexOf(data), data: { ...data } };
  //   } else {
  //     return {
  //       index: -1, data: {
  //         url: url2regex(context.url),
  //         id: uniqueId(),
  //         method: context.method,
  //         type: context.type,
  //         mocks: { },
  //         activeMock: null
  //       }
  //     };
  //   }
  // }

  // static cloneMock(mock: IMock): Partial<IMock> {
  //   if (!mock) {
  //     return { jsCode: MOCK_JS_CODE, delay: 0 };
  //   } else {
  //     const output = {
  //       ...mock,
  //       headers: { ...mock.headers },
  //       headersMock: { ...mock.headersMock }
  //     };
  //     delete output.modifiedOn;

  //     return output;
  //   }
  // }
}
