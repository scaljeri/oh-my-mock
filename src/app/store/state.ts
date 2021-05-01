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
  CreateStatusCode,
  DeleteData,
  DeleteMock,
  InitState,
  ResetState,
  Toggle,
  UpdateDataStatusCode,
  UpdateDataUrl,
  UpsertData,
  UpsertMock,
  ViewChangeOrderItems,
  ViewReset
} from './actions';
import {
  IData,
  IState,
  IUpsertMock,
  requestMethod,
  requestType,
  IDeleteMock,
  ICreateStatusCode,
  IUpdateDataUrl,
  IUpdateDataStatusCode,
  IOhMyMock,
  IStore,
  IMock,
  IOhMyViewItemsOrder,
  IOhMyToggle,
} from '@shared/type';
import * as view from './views';
import { MOCK_JS_CODE, STORAGE_KEY } from '@shared/constants';
import { url2regex } from '@shared/utils/urls';
import { arrayAddItem, arrayMoveItem, arrayRemoveItem } from '@shared/utils/array';
import * as contentParser from 'content-type-parser';
import { addTestData } from '../migrations/test-data';
import { addCurrentDomain } from '../migrations/current-domain';

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
    if (state[STORAGE_KEY]) {
      return state[STORAGE_KEY].domains[domain];
    } else {
      return (state as IOhMyMock).domains[domain];
    }
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
      domains[payload] = { domain: payload, data: [], toggles: {}, views: { normal: [], hits: [] } };
      ctx.setState({ ...state, domains });
    } else {
      ctx.setState(addCurrentDomain(addTestData({ domains: {}, version: state.version }), OhMyState.domain));
    }
  }

  @Action(UpsertMock)
  upsertMock(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IUpsertMock, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state, domain) };

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);

    const dataList = [...domainState.data];
    const mocks = { ...data.mocks };
    const mock = {
      jsCode: MOCK_JS_CODE,
      delay: 0,
      ...mocks[payload.statusCode]
    };

    if (payload.mock) {
      Object.entries(payload.mock).forEach((i) => (mock[i[0]] = i[1]));

      if (!mock.responseMock) {
        mock.createdOn = new Date().toISOString();
        mock.responseMock = mock.response;
      } else {
        mock.modifiedOn = new Date().toISOString();
      }

      if (!mock.headersMock) {
        mock.headersMock = mock.headers;
      }

      if (mock.headersMock) {
        const contentType = contentParser(mock.headersMock['content-type']);
        if (contentType) {
          mock.type = contentType.type;
          mock.subType = contentType.subtype;
        }
      }
    }
    data.mocks = { ...mocks, [payload.statusCode]: mock };

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }
    domainState.data = dataList;

    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    if (index === -1) {
      ctx.dispatch(new UpsertData(data, domain));
    } else {
      ctx.setState({ ...state, domains });
    }
  }

  @Action(UpsertData)
  upsertData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IData, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state, domain) };

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);

    let dataList;

    if (index === -1) { // new
      domainState.views = Object.entries({ ...domainState.views }).reduce((out, [name, list]) => {
        out[name] = view.add(0, list);
        return out;
      }, {});
      dataList = arrayAddItem(domainState.data, data, 0);
    } else {
      dataList = [...domainState.data];
      dataList[index] = data;
    }

    Object.keys(payload).forEach((key) => (data[key] = payload[key]));

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(DeleteMock)
  deleteMock(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IDeleteMock, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state, domain) };

    const { index, data } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );

    const mocks = { ...data.mocks };
    delete mocks[payload.statusCode];
    data.mocks = mocks;

    if (data.activeStatusCode === payload.statusCode) {
      data.activeStatusCode = 0;
    }
    const dataList = [...domainState.data];
    dataList[index] = data;

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(DeleteData)
  deleteData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: number, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state, domain) };

    domainState.views = Object.entries({ ...domainState.views }).reduce((out, [name, data]) => {
      out[name] = view.remove(payload, data);
      return out;
    }, {});
    domainState.data = arrayRemoveItem<IData>(domainState.data, payload)[0];

    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(CreateStatusCode)
  createStatusCode(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: ICreateStatusCode, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state, domain) };

    const { index, data } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );

    data.mocks = {
      ...data.mocks,
      [payload.statusCode]: payload.clone ? OhMyState.cloneMock(data.mocks[data.activeStatusCode]) :
        { jsCode: MOCK_JS_CODE, delay: 0, headers: {}, headersMock: {} }
    };

    if (payload.activeStatusCode) {
      data.activeStatusCode = payload.activeStatusCode;
    }
    const dataList = [...domainState.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(UpdateDataUrl)
  updateDataUrl(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IUpdateDataUrl, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state) };

    const { index, data } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );

    data.url = payload.newUrl;
    const dataList = [...domainState.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(UpdateDataStatusCode)
  updateDataStatusCode(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IUpdateDataStatusCode, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state) };

    const { index, data } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );
    data.activeStatusCode = payload.statusCode;

    const dataList = [...domainState.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    domainState.data = dataList;
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
    url: string,
    method: requestMethod,
    type: requestType
  ): { index: number; data: IData } {
    const data = state.data.find(
      (r) => r.url === url && r.method === method && r.type === type
    ) || { url: url2regex(url), method, type, mocks: {}, activeStatusCode: 0 };

    return { index: state.data.indexOf(data), data: { ...data } };
  }

  static cloneMock(mock: IMock): IMock {
    if (!mock) {
      return { jsCode: MOCK_JS_CODE, delay: 0 };
    } else {
      return {
        ...mock,
        headers: { ...mock.headers },
        headersMock: { ...mock.headersMock }
      };
    }
  }
}
