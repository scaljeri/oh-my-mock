import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { CreateStatusCode, DeleteData, DeleteMock, EnableDomain, InitGlobalState, InitState, UpdateDataStatusCode, UpdateDataUrl, UpsertData, UpsertMock } from './actions';
import { IData, IState, IUpsertMock, requestMethod, requestType, IDeleteMock, ICreateStatusCode, IUpdateDataUrl, IUpdateDataStatusCode, IDeleteData, IOhMyMock, IStore } from '@shared/type';
import { MOCK_JS_CODE, STORAGE_KEY } from '@shared/constants';
import { url2regex } from '@shared/utils/urls';

@State<IOhMyMock>({
  name: STORAGE_KEY,
  defaults: {
    domains: {}
  }
})
@Injectable()
export class OhMyState {
  static getState(state: IStore): IOhMyMock {
    return state[STORAGE_KEY];
  }

  static getActiveState(state: IStore | IOhMyMock): IState {
    if (state[STORAGE_KEY]) {
      return state[STORAGE_KEY].domains[state[STORAGE_KEY].activeDomain];
    } else {
      return (state as IOhMyMock).domains[(state as IOhMyMock).activeDomain];
    }
  }

  @Action(InitState)
  init(ctx: StateContext<IOhMyMock>, { payload }: { payload: IState }) {
    const state = { ...ctx.getState() };
    const domains = { ...state.domains };
    domains[payload.domain] = payload;

    state.domains = domains;
    ctx.setState(state);
  }

  @Action(InitGlobalState)
  initGlobal(ctx: StateContext<IOhMyMock>, { payload }: { payload: IOhMyMock }) {
    const state = ctx.getState();
    const newState = {
      domains: {
        [state.activeDomain]: { data: [], enabled: false, domain: state.activeDomain },
      },
      activeDomain: state.activeDomain,
      ...payload
    };

    ctx.setState(newState);
  }

  @Action(EnableDomain)
  enable(ctx: StateContext<IOhMyMock>, { payload }: { payload: boolean }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state), enabled: payload };
    const domains = { ...state.domains, [state.activeDomain]: domainState };

    ctx.setState({ ...state, domains });
  }

  @Action(UpsertMock)
  upsertMock(ctx: StateContext<IOhMyMock>, { payload }: { payload: IUpsertMock }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) };

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);
    const dataList = [...domainState.data];
    const mocks = { ...data.mocks };
    const mock = { jsCode: MOCK_JS_CODE, useMock: true, ...mocks[payload.statusCode] };

    if (payload.mock) {
      Object.entries(payload.mock).forEach(i => mock[i[0]] = i[1]);
    }
    data.mocks = { ...mocks, [payload.statusCode]: mock };

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }
    domainState.data = dataList;

    const domains = { ...state.domains };
    domains[state.activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(UpsertData)
  upsertData(ctx: StateContext<IOhMyMock>, { payload }: { payload: IData }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) }

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);
    const dataList = [...domainState.data];

    if (index === -1) {
      dataList.push(data)
    } else {
      Object.keys(payload).forEach(key => data[key] = payload[key]);
      dataList[index] = data;
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[state.activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(DeleteMock)
  deleteMock(ctx: StateContext<IOhMyMock>, { payload }: { payload: IDeleteMock }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) }

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);

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
    domains[state.activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(DeleteData)
  deleteData(ctx: StateContext<IOhMyMock>, { payload }: { payload: IDeleteData }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) }

    const { index } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);

    const dataList = [...domainState.data];
    if (index >= 0) {
      dataList.splice(index, 1);
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[state.activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(CreateStatusCode)
  createStatusCode(ctx: StateContext<IOhMyMock>, { payload }: { payload: ICreateStatusCode }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) }

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);

    data.mocks = { ...data.mocks, [payload.statusCode]: { jsCode: MOCK_JS_CODE } };
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
    domains[state.activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(UpdateDataUrl)
  updateDataUrl(ctx: StateContext<IOhMyMock>, { payload }: { payload: IUpdateDataUrl }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) }

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);

    data.url = payload.newUrl;
    const dataList = [...domainState.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[state.activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(UpdateDataStatusCode)
  updateDataStatusCode(ctx: StateContext<IOhMyMock>, { payload }: { payload: IUpdateDataStatusCode }) {
    const state = ctx.getState();
    const domainState = { ...OhMyState.getActiveState(state) }

    const { index, data } = OhMyState.findData(domainState, payload.url, payload.method, payload.type);
    data.activeStatusCode = payload.statusCode;

    const dataList = [...domainState.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[state.activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  static findData(state: IState, url: string, method: requestMethod, type: requestType): { index: number, data: IData } {
    let data = state.data.find(r => r.url === url && r.method === method && r.type === type) || { url: url2regex(url), method, type, mocks: {} };

    return { index: state.data.indexOf(data), data: { ...data } };
  }
}


