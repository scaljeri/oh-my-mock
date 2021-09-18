import {
  State,
  Action,
  StateContext,
  Selector,
  createSelector
} from '@ngxs/store';
import { Inject, Injectable } from '@angular/core';
import {
  ChangeDomain,
  DeleteData,
  DeleteMock,
  InitState,
  LoadMock,
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
  IOhMyShallowMock,
  IMock,
} from '@shared/type';
import { patch } from '@ngxs/store/operators';


import { STORAGE_KEY } from '@shared/constants';

import * as view from '@shared/utils/view';
import { StoreUtils } from '@shared/utils/store';
import { AppStateService } from '../services/app-state.service';
import { StorageService } from '../services/storage.service';
import { DataUtils } from '@shared/utils/data';
import { StorageUtils } from '@shared/utils/storage';
import { StateUtils } from '@shared/utils/state';
import { MigrationUtils } from '../utils/migration';
import { APP_VERSION } from '../tokens';
import { MockUtils } from '@shared/utils/mock';
import { ScenarioUtils } from '@shared/utils/scenario';
import { contentType } from 'mime-types';

@State<IOhMyMock>({
  name: STORAGE_KEY,
  defaults: {
    domains: [],
    version: '',
    content: { mocks: {}, states: {} }
  }
})
@Injectable()
export class OhMyState {
  static domain: string;
  static StorageUtils = StorageUtils;
  static StoreUtils = StoreUtils;
  static StateUtils = StateUtils;
  static DataUtils = DataUtils;
  static MockUtils = MockUtils;
  static ScenarioUtils = ScenarioUtils;
  static MigrationUtils = MigrationUtils;
  constructor(
    @Inject(APP_VERSION) public version: string,
    appStateService: AppStateService,
    private storageService: StorageService) {
    appStateService.domain$.subscribe(domain => OhMyState.domain = domain);
    OhMyState.MigrationUtils.version = version;
  }

  @Selector()
  static mainState(store: IOhMyMock): IState {
    return store.content.states[OhMyState.domain];
  }

  static getStore(ctx: StateContext<IOhMyMock>): IOhMyMock {
    return { ...ctx.getState() };
  }

  static async getActiveState(store: IOhMyMock, domain = OhMyState.domain): Promise<IState> {
    let state = this.StoreUtils.getState(store, domain) || await OhMyState.StorageUtils.get(domain);

    if (!state || Object.keys(state).length === 0) { // TODO: Is object.keys needed?
      state = OhMyState.StateUtils.init({ domain });
    }

    return { ...state };
  }

  static async getMyState(ctx: StateContext<IOhMyMock>, domain?: string): Promise<[IState, string]> {
    const store = this.getStore(ctx);
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...await OhMyState.getActiveState(store, domain) };

    return [domainState, activeDomain];
  }

  /* No states/domains are present yet */
  @Action(InitState) // TODO: Rename InitState to InitStore
  async init(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IOhMyMock, domain?: string }) {
    let store: IOhMyMock;
    const activeDomain = domain || OhMyState.domain;

    store = payload?.domains ? payload : await OhMyState.StorageUtils.get(STORAGE_KEY);

    if (!store || Object.keys(store).length === 0) {
      store = OhMyState.StoreUtils.init(OhMyState.StateUtils.init({ domain: activeDomain }));
    }

    if (OhMyState.MigrationUtils.requireUpdate(store)) {
      store = OhMyState.MigrationUtils.update<IOhMyMock>(store);
      await OhMyState.StorageUtils.setStore(store);
    }

    let state = await OhMyState.StorageUtils.get<IState>(activeDomain) || OhMyState.StateUtils.init({ domain: activeDomain });

    if (OhMyState.MigrationUtils.requireUpdate(state)) {
      state = OhMyState.MigrationUtils.update<IState>(state);
      OhMyState.StorageUtils.set(activeDomain, state);
    }

    if (store.domains.indexOf(activeDomain) === -1) {
      store.domains = [activeDomain, ...store.domains];
      await OhMyState.StorageUtils.setStore(store);
    }

    store.content.states[activeDomain] = state;
    // TODO: Init with test data somehow
    console.log('setState', store);
    ctx.setState(store);
  }

  @Action(ResetState)
  async reset(ctx: StateContext<IOhMyMock>, { payload }: { payload: ohMyDomain }) {
    let store = OhMyState.getStore(ctx);

    if (payload) {
      const state = store.content.states[payload] || await OhMyState.StorageUtils.get(payload);

      if (state) {
        store.content = { ...store.content, mocks: { ...store.content.mocks } };

        OhMyState.StateUtils.getAllMockIds(state).forEach(mockId => {
          OhMyState.StorageUtils.remove(mockId);
          delete store.content.mocks[mockId];
        });
      }

      store = OhMyState.StoreUtils.removeDomain(store, payload)
      OhMyState.StorageUtils.set(STORAGE_KEY, store);
    } else { // reset everything
      await OhMyState.StorageUtils.reset();
      ctx.dispatch(new InitState(null, payload))
    }

    ctx.setState(store);
  }

  @Action(ChangeDomain)
  async changeDomain(ctx: StateContext<IOhMyMock>, { payload }: { payload: ohMyDomain }) {
    OhMyState.domain = payload;

    const store = OhMyState.getStore(ctx);
    if (!store.content.states[payload]) {
      let state = await OhMyState.StorageUtils.get<IState>(payload) || OhMyState.StateUtils.init({ domain: payload });

      if (OhMyState.MigrationUtils.requireUpdate(state)) {
        state = OhMyState.MigrationUtils.update<IState>(state);
        OhMyState.StorageUtils.set(payload, state);
      }

      store.content = { ...store.content, states: { ...store.content.states, [payload]: state } };

      if (store.domains.indexOf(payload) === -1) {
        store.domains = [payload, ...store.domains]
      }
    }

    ctx.setState(store);
  }

  @Action(UpsertMock)
  @Action(UpdateMockStorage)
  async upsertMock(ctx: StateContext<IOhMyMock>, action: UpsertMock | UpdateMockStorage) {
    const { payload, domain } = action;

    let store = OhMyState.getStore(ctx);
    let [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    let mock = payload.mock;
    let sourceMock = {};
    const data = OhMyState.StateUtils.findData(state, payload) || OhMyState.DataUtils.init({
      url: payload.url,
      method: payload.method,
      requestType: payload.requestType
    });

    state.data = { ...state.data, [data.id]: data };

    if (mock.id) {
      sourceMock = store.content.mocks[mock.id] || await OhMyState.StorageUtils.get(mock.id);
      mock = OhMyState.MockUtils.clone(sourceMock, mock);
    } else { // new
      sourceMock = payload.clone ?
        (store.content.mocks[data.activeMock] || await OhMyState.StorageUtils.get<IMock>(data.activeMock)) : null;
    }

    if (sourceMock) {
      store.content = { ...store.content, mocks: { ...store.content.mocks, [data.activeMock]: sourceMock as IMock } };
    }

    mock = OhMyState.MockUtils.init(sourceMock || {}, mock);

    if (payload.makeActive) {
      data.activeMock = mock.id;
    }

    if (!data.mocks[mock.id]) {
      data.mocks = {
        ...data.mocks, [mock.id]: OhMyState.MockUtils.createShallowMock(mock as IOhMyShallowMock)
      }
    }

    if (action instanceof UpsertMock) {
      await OhMyState.StorageUtils.set(activeDomain, state);
      await OhMyState.StorageUtils.set(mock.id, mock);
    }

    store = OhMyState.StoreUtils.setState(store, state);
    ctx.setState(store);
  }

  @Action(UpsertData)
  async upsertData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: Partial<IData>, domain?: string }) {
    let [state] = await OhMyState.getMyState(ctx, domain);

    const data = { ...(OhMyState.StateUtils.findData(state, payload, false) || OhMyState.DataUtils.init(payload)), ...payload };
    state = OhMyState.StateUtils.setData(state, data);
    const store = OhMyState.StoreUtils.setState(OhMyState.getStore(ctx), state);

    await OhMyState.StorageUtils.set(state.domain, state);

    // if (!payload.id) {
    //   state.views = Object.entries(state.views).reduce((acc, [k, v]) => {
    //     acc[k] = [data.id, ...v];

    //     return acc;
    //   }, { });
    // }

    ctx.setState(store);
  }

  // Scenarios are per IState and can be used in every IMock (referenced by scanarioId)
  // TODO: Need Storage action here too
  @Action(UpsertScenarios)
  async upsertScenarios(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: Record<ohMyScenarioId, string>, domain?: string }) {
    const [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    state.scenarios = OhMyState.ScenarioUtils.add(state.scenarios, payload);
    const store = OhMyState.StoreUtils.setState(OhMyState.getStore(ctx), state);
    await OhMyState.StorageUtils.set(state.domain, state);

    ctx.setState(store);
  }

  @Action(DeleteMock)
  @Action(DeleteMockStorage)
  async deleteMock(ctx: StateContext<IOhMyMock>, action: { payload: { id: ohMyDataId, mockId: ohMyMockId }, domain?: string }) {
    const { payload, domain } = action;
    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await OhMyState.getMyState(ctx, domain);

    const data = OhMyState.StateUtils.getData(state, payload.id);
    data.mocks = { ...data.mocks };
    delete data.mocks[payload.mockId];
    state.data = { ...state.data, [data.id]: data };

    if (action instanceof DeleteMock) {
      // TODO: Write to storage
    }

    const domains = { ...store.domains, [activeDomain]: state };

    ctx.setState({ ...store, domains });
  }

  @Action(DeleteData)
  async deleteData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: ohMyDataId, domain?: string }) {
    let store = OhMyState.getStore(ctx);
    const [state] = await OhMyState.getMyState(ctx, domain);

    // NOTE: state is updated by reference!!
    const data = OhMyState.StateUtils.removeData(state, payload);
    store = OhMyState.StoreUtils.removeMocks(store, Object.keys(data.mocks));

    // cleanup
    OhMyState.StorageUtils.remove(Object.keys(data.mocks));
    OhMyState.StorageUtils.set(state.domain, state);

    // state.views = Object.entries(state.views).reduce((acc, [k, v]) => {
    // acc[k] = view.remove(v, payload);
    // return acc;
    // }, {});

    const states = { ...store.content.states, [state.domain]: state };
    ctx.setState({ ...store, content: { ...store.content, states } });
  }

  @Action(ViewChangeOrderItems)
  async viewChangeOrderOfItems(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyViewItemsOrder }) {
    const store = OhMyState.getStore(ctx);
    const [state] = await OhMyState.getMyState(ctx);

    const id = state.views[payload.name][payload.id];
    state.views = { ...state.views, [payload.name]: view.move(state.views[payload.name], id, payload.to) };

    const content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };

    ctx.setState({ ...store, content });
  }

  @Action(Toggle)
  async toggle(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyToggle }) {
    const store = OhMyState.getStore(ctx);
    const [state] = await OhMyState.getMyState(ctx);

    state.toggles = { ...state.toggles, [payload.name]: payload.value };
    await OhMyState.StorageUtils.set(state.domain, state);
    const content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };

    ctx.setState({ ...store, content });
  }

  @Action(ViewReset)
  async viewReset(ctx: StateContext<IOhMyMock>, { payload }: { payload: string }) {
    const store = OhMyState.getStore(ctx);
    const [state] = await OhMyState.getMyState(ctx);

    state.views = { ...state.views, [payload]: Object.keys(state.data) };

    const content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };

    ctx.setState({ ...store, content });
  }

  @Action(LoadMock)
  async loadMock(ctx: StateContext<IOhMyMock>, { payload }: { payload: { id: ohMyMockId } & Partial<IOhMyShallowMock> }) {
    const store = OhMyState.getStore(ctx);
    store.content.mocks = { ...store.content.mocks };

    if (store.content.mocks[payload.id]) {
      store.content.mocks[payload.id] = { ...store.content.mocks[payload.id] };
    } else  {
      store.content.mocks[payload.id] = await OhMyState.StorageUtils.get<IMock>(payload.id) ||
        OhMyState.MockUtils.init(payload);
    }

    ctx.setState(store)
  }
}
