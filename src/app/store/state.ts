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
  ResetState,
  Toggle,
  UpsertData,
  UpsertMock,
  UpsertScenarios,
  ViewChangeOrderItems,
  ViewReset
} from './actions';
import {
  IData,
  IState,
  IOhMyMock,
  IStore,
  IMock,
  IOhMyViewItemsOrder,
  IOhMyToggle,
  IOhMyContext,
  ohMyMockId,
  ohMyDataId,
  IUpsertMock,
  ohMyScenarioId,
} from '@shared/type';
import * as view from './views';
import { MOCK_JS_CODE, STORAGE_KEY } from '@shared/constants';
import { url2regex } from '@shared/utils/urls';
import { arrayAddItem, arrayMoveItem, arrayRemoveItem } from '@shared/utils/array';
import contentParser from 'content-type-parser';
import { addTestData } from '../migrations/test-data';
import { addCurrentDomain } from '../migrations/current-domain';
import { uniqueId } from '@shared/utils/unique-id';
import { findMocks } from '@shared/utils/find-mock';
import { createNewMock } from './create-mock';
@State<IOhMyMock>({
  name: STORAGE_KEY,
  defaults: {
    domains: {},
    version: ''
  }
})
@Injectable()
export class OhMyState {
  static domain: string;

  @Selector()
  static mainState(store: IStore): IState {
    return this.getActiveState(store);
  }

  static getState(state: IStore): IOhMyMock {
    return state[STORAGE_KEY];
  }

  static getActiveState(state: IStore | IOhMyMock, domain = OhMyState.domain): IState {
    let output;

    if (state[STORAGE_KEY]) {
      output = state[STORAGE_KEY].domains[domain];
    } else {
      output = (state as IOhMyMock).domains[domain];
    }

    return output || { domain, views: {}, toggles: {}, data: [], scenarios: {} };
  }

  static getMyState(ctx: StateContext<IOhMyMock>, domain: string): [IState, string] {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state, domain) };

    return [domainState, activeDomain];
  }

  @Action(InitState)
  init(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IOhMyMock, domain?: string }) {
    const activeDomain = domain || OhMyState.domain;
    const state = addCurrentDomain(addTestData({ ...ctx.getState(), ...payload }), activeDomain);

    ctx.setState(state);
  }

  @Action(ChangeDomain)
  changeDomain(ctx: StateContext<IOhMyMock>, { payload }: { payload: string }) {
    OhMyState.domain = payload;
    const state = addCurrentDomain(ctx.getState(), payload);

    ctx.setState(state);
  }

  @Action(ResetState) // payload === domain string (optional)
  reset(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: string, domain?: string }) {
    const state = ctx.getState();
    // const activeDomain = domain || OhMyState.domain;
    const domains = { ...state.domains };

    // TODO: unclear what `domain` argument is doing here, is it needed, don't think so?
    if (payload) {
      domains[payload] = { domain: payload, data: [], toggles: {}, views: { normal: [], hits: [] }, scenarios: {} };
      ctx.setState({ ...state, domains });
    } else {
      ctx.setState(addCurrentDomain(addTestData({ domains: {}, version: state.version }), OhMyState.domain));
    }
  }

  @Action(UpsertMock)
  upsertMock(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IUpsertMock, domain?: string }) {
    const [state, activeDomain] = OhMyState.getMyState(ctx, domain);

    const { index, data } = OhMyState.findData(state, payload);
    const mock = createNewMock(payload.mock, data, payload.clone);
    const dataList = [...state.data];
    const mocks = { ...data.mocks };

    if (payload.makeActive || !payload.mock.id && Object.keys(data.mocks).length === 0) {
      data.activeMock = mock.id;

      if (state.toggles.activateNew) {
        data.enabled = true;
      }
    }

    data.mocks = { ...mocks, [mock.id]: mock };

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }
    state.data = dataList;

    const domains = { ...ctx.getState().domains };
    domains[activeDomain] = state;

    if (index === -1) {
      ctx.dispatch(new UpsertData(data, domain));
    } else {
      ctx.setState({ ...ctx.getState(), domains });
    }
  }

  @Action(UpsertData)
  upsertData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IData, domain?: string }) {
    const [state, activeDomain] = OhMyState.getMyState(ctx, domain);
    const { index, data } = OhMyState.findData(state, payload);

    let dataList;

    if (index === -1) { // new
      state.views = Object.entries({ ...state.views }).reduce((out, [name, list]) => {
        out[name] = view.add(0, list);
        return out;
      }, {});
      dataList = arrayAddItem(state.data, data, 0);
    } else {
      dataList = [...state.data];
      dataList[index] = data;
    }

    Object.keys(payload).forEach((key) => (data[key] = payload[key]));

    if (index === -1 && !payload.id) {
      data.url = url2regex(payload.url);
    }

    state.data = dataList;
    const domains = { ...ctx.getState().domains };
    domains[activeDomain] = state;

    ctx.setState({ ...ctx.getState(), domains });
  }

  @Action(UpsertScenarios)
  upsertScenarios(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: Record<ohMyScenarioId, string>, domain?: string }) {
    const [state, activeDomain] = OhMyState.getMyState(ctx, domain);

    // TODO: check for duplicate name values (replace old one???)
    state.scenarios = { ...state.scenarios, ...payload };
    
    const domains = { ...ctx.getState().domains };
    domains[activeDomain] = state;

    ctx.setState({ ...ctx.getState(), domains });
  }

  @Action(DeleteMock)
  deleteMock(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: { id: ohMyDataId, mockId: ohMyMockId }, domain?: string }) {
    const [state, activeDomain] = OhMyState.getMyState(ctx, domain);
    const { index, data } = OhMyState.findData(state, payload)

    const mocks = { ...data.mocks };
    delete mocks[payload.mockId];
    data.mocks = mocks;

    if (data.activeMock === payload.mockId) {
      data.activeMock = null;
    }
    const dataList = [...state.data];
    dataList[index] = data;

    state.data = dataList;
    const domains = { ...ctx.getState().domains };
    domains[activeDomain] = state;

    ctx.setState({ ...ctx.getState(), domains });
  }

  @Action(DeleteData)
  deleteData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: string, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state, domain) };

    const data = findMocks(domainState, { id: payload });
    const index = domainState.data.indexOf(data);

    domainState.views = Object.entries({ ...domainState.views }).reduce((out, [name, data]) => {
      out[name] = view.remove(index, data);
      return out;
    }, {});
    domainState.data = arrayRemoveItem<IData>(domainState.data, index)[0];

    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(ViewChangeOrderItems)
  viewChangeOrderOfItems(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyViewItemsOrder }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) };

    const views = { ...domainState.views };

    if (!views[payload.name]) { // init
      views[payload.name] = domainState.data.map((_, i) => i);
    }

    views[payload.name] = arrayMoveItem<number>(views[payload.name], payload.from, payload.to);
    domainState.views = views;

    const domains = { ...state.domains };
    domains[OhMyState.domain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(Toggle)
  toggle(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyToggle }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) };
    domainState.toggles = { ...domainState.toggles, [payload.name]: payload.value };

    const domains = { ...state.domains, [OhMyState.domain]: domainState };
    ctx.setState({ ...state, domains });
  }

  @Action(ViewReset)
  viewReset(ctx: StateContext<IOhMyMock>, { payload }: { payload: string }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) };
    const views = { ...domainState.views, [payload]: domainState.data.map((_, i) => i) };
    domainState.views = views;

    const domains = { ...state.domains, [OhMyState.domain]: domainState };
    ctx.setState({ ...state, domains });
  }

  static findData(
    state: IState,
    context: IOhMyContext
  ): { index: number; data: IData } {
    const data = findMocks(state, context);
    const index = !data ? -1 : state.data.indexOf(data);

    if (index >= 0) {
      return { index: state.data.indexOf(data), data: { ...data } };
    } else {
      return {
        index: -1, data: {
          url: url2regex(context.url),
          id: uniqueId(),
          method: context.method,
          type: context.type,
          mocks: {},
          activeMock: null
        }
      };
    }
  }

  static cloneMock(mock: IMock): Partial<IMock> {
    if (!mock) {
      return { jsCode: MOCK_JS_CODE, delay: 0 };
    } else {
      const output = {
        ...mock,
        headers: { ...mock.headers },
        headersMock: { ...mock.headersMock }
      };
      delete output.modifiedOn;

      return output;
    }
  }
}
