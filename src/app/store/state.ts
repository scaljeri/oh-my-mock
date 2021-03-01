import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { CreateStatusCode, DeleteMock, EnableDomain, InitState, UpsertData, UpsertMock } from './actions';
import { IData, IState, IUpsertMock, requestMethod, requestType, IDeleteMock, ICreateStatusCode } from '@shared/type';
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
  // private domain = this.window.location.hostname;;
  // constructor(private window: Window) {
  // chrome.storage.local.set({ [STORAGE_KEY]: { domains: {}} });
  //  }

  // static node(id: string) {
  // return createSelector([OhMyState], (state: IFbpState) => {
  //         return state.nodes?.find(node => node.id === id);
  //     });
  // }

  // @Selector([FbpState])
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
  upsertResponses(ctx: StateContext<IState>, { payload }: { payload: IUpsertMock }) {
    const state = ctx.getState();
    const source: IData = OhMyState.findData(state, payload.url, payload.method, payload.type) || {
      url: payload.url,
      method: payload.method,
      type: payload.type,
      mocks: {}
    };

    const indexOf = state.data.indexOf(source);
    const data = [...state.data];

    const updated = {
      ...source,
      mocks: {
        ...source.mocks,
        [payload.statusCode]: {
          response: payload.response,
          dataType: payload.dataType
        }
      }
    };

    if (indexOf === -1) {
      data.push(updated);
    } else {
      data[indexOf] = updated;
    }
    console.log('STORE: state updates(upsert)', state, data);
    ctx.setState({ ...state, data });
  }

  @Action(UpsertData)
  upsertData(ctx: StateContext<IState>, { payload }: { payload: IData }) {
    console.log('TODO');
  }

  @Action(DeleteMock)
  deleteResponse(ctx: StateContext<IState>, { payload }: { payload: IDeleteMock }) {
    const state = ctx.getState();
    const origMockResponses: IData = OhMyState.findData(state, payload.url, payload.method, payload.type);

    const mocks = { ...origMockResponses.mocks };
    delete mocks[payload.statusCode];

    const mockResponses = { ...origMockResponses, mocks };
    const index = state.data.indexOf(origMockResponses);

    const data = [...state.data];
    data[index] = mockResponses;

    ctx.setState({ ...state, data });
  }

  @Action(CreateStatusCode)
  createStatusCode(ctx: StateContext<IState>, { payload }: { payload: ICreateStatusCode }) {
    const state = ctx.getState();
    const { url, method, type, statusCode } = payload;
    const origData: IData = OhMyState.findData(state, url, method, type);
    const data: IData = { ...origData };
    data.mocks = {
      ...data.mocks,
      [statusCode]: { jsCode: MOCK_JS_CODE }
    };
    const index = state.data.indexOf(origData);
    const newState = { ...state, data: [...state.data ]};
    newState.data[index] = data;

    ctx.setState(newState);
  }

  static findData(state: IState, url: string, method: requestMethod, type: requestType): IData | null {
    return state.data.find(r =>
      r.url === url && r.method === method && r.type === type) || null;
  }
}


