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
  LoadState,
  ResetState,
  Aux,
  UpdateState,
  UpsertData,
  UpsertMock,
  UpsertScenarios,
  ViewChangeOrderItems,
  ViewReset,
  ScenarioFilter,
  PresetCreate
} from './actions';
import { DeleteMockStorage, UpdateMockStorage } from './storage-actions';

import {
  IData,
  IState,
  IOhMyMock,
  IOhMyViewItemsOrder,
  ohMyMockId,
  ohMyDataId,
  ohMyDomain,
  IOhMyShallowMock,
  IMock,
  domain,
  IOhMyPresetChange,
} from '@shared/type';
import { patch } from '@ngxs/store/operators';
import { ContextService } from '../services/context.service';

import { STORAGE_KEY } from '@shared/constants';

import * as view from '@shared/utils/view';
import { StoreUtils } from '@shared/utils/store';
import { AppStateService } from '../services/app-state.service';
import { DataUtils } from '@shared/utils/data';
import { StorageUtils } from '@shared/utils/storage';
import { StateUtils } from '@shared/utils/state';
import { MigrationUtils } from '../utils/migration';
import { APP_VERSION } from '../tokens';
import { MockUtils } from '@shared/utils/mock';
import { OhMyScenarios, PresetUtils } from '@shared/utils/preset';
import { timestamp } from '@shared/utils/timestamp';
import { arrayRemoveItem } from '@shared/utils/array';
import { uniqueId } from '@shared/utils/unique-id';

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
  static PresetUtils = PresetUtils;

  constructor(private context: ContextService) { }

  @Selector()
  static mainState(store: IOhMyMock): IState {
    return null; // store.content.states[this.context.domain];
  }

  static getStore(ctx: StateContext<IOhMyMock>): IOhMyMock {
    return { ...ctx.getState() };
  }

  async getActiveState(store: IOhMyMock, domain = this.context.domain): Promise<IState> {
    let state = OhMyState.StoreUtils.getState(store, domain) ||
      await OhMyState.StorageUtils.get(domain);

    // TODO: check if Object.keys is needed here
    if (!state || Object.keys(state).length === 0) {
      state = OhMyState.StateUtils.init({ domain });
    }

    return { ...state };
  }

  async getMyState(ctx: StateContext<IOhMyMock>, domain?: string): Promise<[IState, string]> {
    const store = OhMyState.getStore(ctx);
    const activeDomain = domain || this.context.domain;
    const domainState = { ...await this.getActiveState(store, domain) };

    return [domainState, activeDomain];
  }

  @Action(InitState)
  async init(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IOhMyMock, domain?: string }) {
    let store: IOhMyMock;

    store = payload?.domains ? payload : await OhMyState.StorageUtils.get();

    if (!store || Object.keys(store).length === 0) {
      store = OhMyState.StoreUtils.init(OhMyState.StateUtils.init({ domain }));
      await OhMyState.StorageUtils.set(STORAGE_KEY, store);
    }

    const state = await OhMyState.StorageUtils.get<IState>(domain) || OhMyState.StateUtils.init({ domain });

    // Integrity check: Where does this belong?
    if (!state.context.preset) {
      state.context.preset = Object.keys(state.presets)[0];
    }

    if (store.domains.indexOf(domain) === -1) {
      store.domains = [domain, ...store.domains];
      await OhMyState.StorageUtils.setStore(store);
    }

    store.content.states[domain] = state;
    // TODO: Init with test data somehow
    this.context.update(state.context);
    ctx.setState(store);
  }

  @Action(ResetState)
  async reset(ctx: StateContext<IOhMyMock>, { payload }: { payload: ohMyDomain }) {
    let store = OhMyState.getStore(ctx);

    if (payload) {
      const state = store.content.states[payload] || await OhMyState.StorageUtils.get(payload);

      if (state) {
        store.content = { ...store.content, mocks: { ...store.content.mocks } };

        OhMyState.StateUtils.getAllMockIds(state).forEach(async mockId => {
          await OhMyState.StorageUtils.remove(mockId);
          delete store.content.mocks[mockId];
        });
      }

      store = OhMyState.StoreUtils.removeDomain(store, payload)
      await OhMyState.StorageUtils.remove(state.domain);
      await OhMyState.StorageUtils.set(STORAGE_KEY, store);
    } else { // reset everything
      await OhMyState.StorageUtils.reset();
    }

    if (!payload || payload === this.context.domain) {
      ctx.dispatch(new InitState(null, this.context.domain));
    }

    ctx.setState(store);
  }

  @Action(ChangeDomain)
  async changeDomain(ctx: StateContext<IOhMyMock>, { payload }: { payload: ohMyDomain }) {
    OhMyState.domain = payload;

    const store = OhMyState.getStore(ctx);
    if (!store.content.states[payload]) {
      const state = await OhMyState.StorageUtils.get<IState>(payload) || OhMyState.StateUtils.init({ domain: payload });

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
    const [state, activeDomain] = await this.getMyState(ctx, domain);

    const data = OhMyState.StateUtils.findData(state, payload) || OhMyState.DataUtils.init({
      url: payload.url,
      method: payload.method,
      requestType: payload.requestType
    });

    let mock: IMock;
    let mockId: ohMyMockId;

    if (payload.mock.id) {
      mockId = mock.id;
    } else if (payload.clone) {

      if (payload.clone === true) {
        mockId = data.selected[state.context.preset];
      } else {
        mockId = payload.clone;
      }
    }

    if (mockId) {
      mock = { ...(store.content.mocks[mock.id] || await OhMyState.StorageUtils.get(mock.id)), ...payload.mock };

      if (payload.clone) {
        mock.id = uniqueId();
        mock.createdOn =  timestamp();
        delete mock.modifiedOn;
      }
    } else {
      mock = OhMyState.MockUtils.init(payload.mock);
    }

    if (payload.makeActive) {
      data.selected[state.context.preset] = mock.id;
      data.enabled[state.context.preset] = true;
    }

    data.mocks = {
      ...data.mocks,
      [mock.id]: OhMyState.MockUtils.createShallowMock(mock as IOhMyShallowMock)
    };

    state.data = { ...state.data, [data.id]: data };

    if (action instanceof UpsertMock) {
      await OhMyState.StorageUtils.set(activeDomain, state);
      await OhMyState.StorageUtils.set(mock.id, mock);
    }

    store = OhMyState.StoreUtils.setState(store, state);
    ctx.setState(store);
  }

  @Action(UpsertData)
  async upsertData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: Partial<IData>, domain?: string }) {
    let [state] = await this.getMyState(ctx, domain);

    const data = { ...(OhMyState.StateUtils.findData(state, payload) || OhMyState.DataUtils.init(payload)), ...payload };
    state = OhMyState.StateUtils.setData(state, data);
    const store = OhMyState.StoreUtils.setState(OhMyState.getStore(ctx), state);
    // state.views = { ...state.views };

    // Object.entries(state.views).forEach(([name, list]) => {
    //   if (!list.includes(data.id)) {
    //     state.views[name] = [data.id, ...state.views[name]];
    //   }
    // });

    await OhMyState.StorageUtils.set(state.domain, state);
    ctx.setState(store);
  }

  // Scenarios are per IState and can be used in every IMock (referenced by scanarioId)
  // TODO: Need Storage action here too
  // @Action(UpsertScenarios)
  // async upsertScenarios(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: OhMyScenarios, domain?: string }) {
  //   const [state, activeDomain] = await this.getMyState(ctx, domain);

  //   state.presets = { ...payload }; // OhMyState.ScenarioUtils.add(state.scenarios, payload);
  //   const store = OhMyState.StoreUtils.setState(OhMyState.getStore(ctx), state);

  //   await OhMyState.StorageUtils.set(state.domain, state);

  //   ctx.setState(store);
  // }

  @Action(DeleteMock)
  @Action(DeleteMockStorage)
  async deleteMock(ctx: StateContext<IOhMyMock>, action: { payload: { id: ohMyDataId, mockId: ohMyMockId }, domain?: string }) {
    const { payload, domain } = action;

    const store = OhMyState.getStore(ctx);
    const [state, activeDomain] = await this.getMyState(ctx, domain);
    const data = OhMyState.DataUtils.removeMock(state.context,
      OhMyState.StateUtils.getData(state, payload.id), payload.mockId);

    state.data = { ...state.data, [data.id]: data };

    const content = {
      ...store.content,
      mocks: { ...store.content.mocks },
      states: { ...store.content.states, [activeDomain]: state }
    };
    delete content.mocks[payload.mockId];

    if (action instanceof DeleteMock) {
      await OhMyState.StorageUtils.reset(payload.mockId);
      await OhMyState.StorageUtils.set(state.domain, state);
    }

    ctx.setState({ ...store, content });
  }

  @Action(DeleteData)
  async deleteData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: ohMyDataId, domain?: string }) {
    let store = OhMyState.getStore(ctx);
    const [state] = await this.getMyState(ctx, domain);

    // NOTE: `state` is updated by reference!!
    const data = OhMyState.StateUtils.removeData(state, payload);
    store = OhMyState.StoreUtils.removeMocks(store, Object.keys(data.mocks));

    // cleanup
    OhMyState.StorageUtils.remove(Object.keys(data.mocks));
    OhMyState.StorageUtils.set(state.domain, state);

    // Object.entries(state.views).forEach(([name, list]) => {
    //   if (list.includes(data.id)) {
    //     const index = state.views[name].indexOf(data.id);
    //     state.views[name] = arrayRemoveItem(state.views[name], index)[0];
    //   }
    // });
    await OhMyState.StorageUtils.set(state.domain, state);

    const states = { ...store.content.states, [state.domain]: state };
    ctx.setState({ ...store, content: { ...store.content, states } });
  }

  @Action(ViewChangeOrderItems)
  async viewChangeOrderOfItems(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyViewItemsOrder }) {
    const store = OhMyState.getStore(ctx);
    const [state] = await this.getMyState(ctx);

    // const id = state.views[payload.name][payload.id];
    // state.views = { ...state.views, [payload.name]: view.move(state.views[payload.name], id, payload.to) };

    const content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };

    ctx.setState({ ...store, content });
  }

  @Action(Aux)
  async aux(ctx: StateContext<IOhMyMock>, { payload }: { payload: Record<string, unknown> }) {
    const store = OhMyState.getStore(ctx);
    const [state] = await this.getMyState(ctx);

    state.aux = { ...state.aux };
    Object.entries(payload).forEach(([k, v]) => {
      state.aux[k] = v;
    });

    await OhMyState.StorageUtils.set(state.domain, state);
    const content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };

    ctx.setState({ ...store, content });
  }

  @Action(ViewReset)
  async viewReset(ctx: StateContext<IOhMyMock>, { payload }: { payload: string }) {
    const store = OhMyState.getStore(ctx);
    const [state] = await this.getMyState(ctx);

    // state.views = { ...state.views, [payload]: Object.keys(state.data) };

    const content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };

    ctx.setState({ ...store, content });
  }

  @Action(LoadMock)
  async loadMock(ctx: StateContext<IOhMyMock>, { payload }: { payload: { id: ohMyMockId } & Partial<IOhMyShallowMock> }) {
    const store = OhMyState.getStore(ctx);
    store.content.mocks = { ...store.content.mocks };

    if (store.content.mocks[payload.id]) {
      store.content.mocks[payload.id] = { ...store.content.mocks[payload.id] };
    } else {
      let mock = await OhMyState.StorageUtils.get<IMock>(payload.id);

      if (!mock) {
        mock = OhMyState.MockUtils.init(null, payload);
        OhMyState.StorageUtils.set(mock.id, mock);
      }

      store.content.mocks[payload.id] = mock;
    }

    ctx.setState(store)
  }

  // `state` should always be present!
  @Action(UpdateState)
  async updateState(ctx: StateContext<IOhMyMock>, { payload }: { payload: IState }) {
    const store = OhMyState.getStore(ctx);
    const state = { ...store.content.states[payload.domain], ...payload };

    await OhMyState.StorageUtils.set(state.domain, state);

    store.content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };
    ctx.setState(store)
  }

  @Action(LoadState)
  async loadState(ctx: StateContext<IOhMyMock>, { payload }: { payload: domain }) {
    const store = OhMyState.getStore(ctx);
    store.content = { ...store.content, states: { ...store.content.states } };

    if (store.content.states[payload]) {
      store.content.states[payload] = { ...store.content.states[payload] };
    } else {
      let state = await OhMyState.StorageUtils.get<IState>(payload);

      if (!state) {
        state = OhMyState.StateUtils.init({ domain: payload });
        await OhMyState.StorageUtils.set(payload, state);
      }

      store.content.states[payload] = state;
    }

    ctx.setState(store)
  }

  // @Action(PresetCreate)
  // async updatePresets(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyPresetChange[] | IOhMyPresetChange }) {
  //   if (!Array.isArray(payload)) {
  //     payload = [payload];
  //   }

  //   const store = OhMyState.getStore(ctx);
  //   let [state] = await this.getMyState(ctx);

  //   payload.forEach(p => {
  //     state = OhMyState.StateUtils.updatePreset(state, p);
  //   });

  //   // state = OhMyState.StateUtils.activateScenario(state, payload);

  //   // store.content = {
  //   //   ...store.content, states: {
  //   //     ...store.content.states,
  //   //     [state.domain]: state
  //   //   }
  //   // };

  //   await OhMyState.StorageUtils.set(state.domain, state);
  //   // ctx.patchState({content: })
  //   ctx.setState(store)
  // }

  @Action(PresetCreate)
  async presetChange(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyPresetChange | IOhMyPresetChange[] }) {
    const store = OhMyState.getStore(ctx);
    const [state] = await this.getMyState(ctx);
    state.presets = { ...state.presets };
    state.data = { ...state.data };
    state.context = { ...state.context };

    if (!Array.isArray(payload)) {
      payload = [payload];
    }

    payload.forEach(change => {
      if (change.delete) {
        delete state.presets[change.id];
        // state.context.preset = OhMyState.PresetUtils.findId(state.presets, Object.values(state.presets).sort()[0]);
        if (change.id === state.context.preset) {
          delete state.context.preset;
          this.context.update({ preset: undefined });
        }

        Object.values(state.data).map(d => {
          const data = { ...d, presets: { ...d.selected }, enabled: { ...d.enabled } };
          delete data.presets[change.id];
          delete data.enabled[change.id];
        })
      } else { // new or update
        state.presets[change.id] = change.value;

        if (change.activate) {
          state.context.preset = change.id;
          this.context.update({ preset: change.id });
        }
      }
    });

    OhMyState.StorageUtils.set(state.domain, state);

    store.content = { ...store.content, states: { ...store.content.states, [state.domain]: state } };
    ctx.setState(store)
  }
}
