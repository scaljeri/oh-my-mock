import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { CreateStatusCode, DeleteData, DeleteMock, EnableDomain, InitState, UpdateDataStatusCode, UpdateDataUrl, UpsertData, UpsertMock } from './actions';
import { IData, IState, IUpsertMock, requestMethod, requestType, IDeleteMock, ICreateStatusCode, IUpdateDataUrl, IUpdateDataStatusCode, IDeleteData } from '@shared/type';
import { MOCK_JS_CODE, STORAGE_KEY } from '@shared/constants';

@State<IState>({
  name: STORAGE_KEY,
  defaults: {
    domain: '',
    data: []
  }
})
@Injectable()
export class OhMyState {
  static getState(state: IState): IState {
    return state;
  }

  @Action(InitState)
  init(ctx: StateContext<IState>, { payload }: { payload: IState }) {
    ctx.setState(payload);
  }

  @Action(EnableDomain)
  enable(ctx: StateContext<IState>, { payload }: { payload: boolean }) {
    const state = ctx.getState();
    ctx.setState({ ...state, enabled: payload });
  }

  @Action(UpsertMock)
  upsertMock(ctx: StateContext<IState>, { payload }: { payload: IUpsertMock }) {
    const state = ctx.getState();
    const { index, data } = OhMyState.findData(state, payload.url, payload.method, payload.type);
    const dataList = [...state.data];
    const mocks = { ...data.mocks };
    const mock = { jsCode: MOCK_JS_CODE, ...mocks[payload.statusCode] };

    if (payload.mock) {
      Object.entries(payload.mock).forEach(i => mock[i[0]] = i[1]);
    }
    data.mocks = { ...mocks, [payload.statusCode]: mock };

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    ctx.setState({ ...state, data: dataList });
  }

  @Action(UpsertData)
  upsertData(ctx: StateContext<IState>, { payload }: { payload: IData }) {
    const state = ctx.getState();
    const { index, data } = OhMyState.findData(state, payload.url, payload.method, payload.type);
    const dataList = [...state.data];

    if (index === -1) {
      dataList.push(data)
    } else {
      Object.keys(payload).forEach(key => data[key] = payload[key]);
      dataList[index] = data;
    }

    ctx.setState({ ...state, data: dataList });
  }

  @Action(DeleteMock)
  deleteMock(ctx: StateContext<IState>, { payload }: { payload: IDeleteMock }) {
    const state = ctx.getState();
    const { index, data } = OhMyState.findData(state, payload.url, payload.method, payload.type);

    const mocks = { ...data.mocks };
    delete mocks[payload.statusCode];
    data.mocks = mocks;

    if (data.activeStatusCode === payload.statusCode) {
      data.activeStatusCode = 0;
    }
    const dataList = [...state.data];
    dataList[index] = data;

    ctx.setState({ ...state, data: dataList });
  }

  @Action(DeleteData)
  deleteData(ctx: StateContext<IState>, { payload }: { payload: IDeleteData }) {
    const state = ctx.getState();
    const { index } = OhMyState.findData(state, payload.url, payload.method, payload.type);

    const dataList = [...state.data];
    if (index >= 0) {
      dataList.splice(index, 1);
    }

    ctx.setState({ ...state, data: dataList });
  }

  @Action(CreateStatusCode)
  createStatusCode(ctx: StateContext<IState>, { payload }: { payload: ICreateStatusCode }) {
    const state = ctx.getState();
    const { index, data } = OhMyState.findData(state, payload.url, payload.method, payload.type);

    data.mocks = { ...data.mocks, [payload.statusCode]: { jsCode: MOCK_JS_CODE } };
    if (payload.activeStatusCode) {
      data.activeStatusCode = payload.activeStatusCode;
    }
    const dataList = [...state.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    ctx.setState({ ...state, data: dataList });
  }

  @Action(UpdateDataUrl)
  updateDataUrl(ctx: StateContext<IState>, { payload }: { payload: IUpdateDataUrl }) {
    const state = ctx.getState();
    const { index, data } = OhMyState.findData(state, payload.url, payload.method, payload.type);

    data.url = payload.newUrl;
    const dataList = [...state.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    ctx.setState({ ...state, data: dataList });
  }

  @Action(UpdateDataStatusCode)
  updateDataStatusCode(ctx: StateContext<IState>, { payload }: { payload: IUpdateDataStatusCode }) {
    const state = ctx.getState();

    const { index, data } = OhMyState.findData(state, payload.url, payload.method, payload.type);
    data.activeStatusCode = payload.statusCode;

    const dataList = [...state.data];

    if (index === -1) {
      dataList.push(data);
    } else {
      dataList[index] = data;
    }

    ctx.setState({ ...state, data: dataList });
  }

  static findData(state: IState, url: string, method: requestMethod, type: requestType): { index: number, data: IData } {
    let data = state.data.find(r => r.url === url && r.method === method && r.type === type) || { url, method, type, mocks: {} };

    return { index: state.data.indexOf(data), data: { ...data } };
  }
}


