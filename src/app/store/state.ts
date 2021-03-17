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
  EnableDomain,
  InitState,
  ResetState,
  UpdateDataStatusCode,
  UpdateDataUrl,
  UpsertData,
  UpsertMock
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
  IDeleteData,
  IOhMyMock,
  IStore
} from '@shared/type';
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
  static domain: string;

  static getState(state: IStore): IOhMyMock {
    return state[STORAGE_KEY];
  }

  static getActiveState(state: IStore | IOhMyMock): IState {
    if (state[STORAGE_KEY]) {
      return state[STORAGE_KEY].domains[OhMyState.domain];
    } else {
      return (state as IOhMyMock).domains[OhMyState.domain];
    }
  }

  @Action(InitState)
  init(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IOhMyMock, domain?: string }) {
    const state = { ...ctx.getState(), ...payload };

    if (state.domains === undefined) {
      state.domains = {};
    }

    const activeDomain = domain || OhMyState.domain;

    if (state.domains[activeDomain] === undefined) {
      state.domains = {
        ...state.domains,
        [activeDomain]: {
          domain: activeDomain,
          data: [],
          enabled: false
        }
      };
    }

    ctx.setState(state);
  }

  @Action(ChangeDomain)
  changeDomain(ctx: StateContext<IOhMyMock>, { payload }: { payload: string }) {
    OhMyState.domain = payload;
    const state = { ...ctx.getState() };
    ctx.setState(state);
  }

  @Action(ResetState) // payload === domain string (optional)
  reset(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: string, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    let domains = { ...state.domains };

    if (payload) {
      domains[payload] = { domain: payload, data: [] };
    } else {
      domains = {
        [activeDomain]: { domain: activeDomain, data: [] }
      };
    }

    ctx.setState({ ...state, domains });
  }

  @Action(EnableDomain)
  enable(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: boolean, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = {
      ...OhMyState.getActiveState(state),
      enabled: payload
    };
    const domains = { ...state.domains, [activeDomain]: domainState };

    ctx.setState({ ...state, domains });
  }

  @Action(UpsertMock)
  upsertMock(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IUpsertMock, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state) };

    const { index, data } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );
    const dataList = [...domainState.data];
    const mocks = { ...data.mocks };
    const mock = {
      jsCode: MOCK_JS_CODE,
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

    ctx.setState({ ...state, domains });
  }

  @Action(UpsertData)
  upsertData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IData, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state) };

    const { index, data } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );
    const dataList = [...domainState.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      Object.keys(payload).forEach((key) => (data[key] = payload[key]));
      dataList[index] = data;
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(DeleteMock)
  deleteMock(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IDeleteMock, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state) };

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
  deleteData(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: IDeleteData, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state) };

    const { index } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );

    const dataList = [...domainState.data];
    if (index >= 0) {
      dataList.splice(index, 1);
    }

    domainState.data = dataList;
    const domains = { ...state.domains };
    domains[activeDomain] = domainState;

    ctx.setState({ ...state, domains });
  }

  @Action(CreateStatusCode)
  createStatusCode(ctx: StateContext<IOhMyMock>, { payload, domain }: { payload: ICreateStatusCode, domain?: string }) {
    const state = ctx.getState();
    const activeDomain = domain || OhMyState.domain;
    const domainState = { ...OhMyState.getActiveState(state) };

    const { index, data } = OhMyState.findData(
      domainState,
      payload.url,
      payload.method,
      payload.type
    );

    data.mocks = {
      ...data.mocks,
      [payload.statusCode]: { jsCode: MOCK_JS_CODE }
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

  static findData(
    state: IState,
    url: string,
    method: requestMethod,
    type: requestType
  ): { index: number; data: IData } {
    const data = state.data.find(
      (r) => r.url === url && r.method === method && r.type === type
    ) || { url: url2regex(url), method, type, mocks: {} };

    return { index: state.data.indexOf(data), data: { ...data } };
  }
}
