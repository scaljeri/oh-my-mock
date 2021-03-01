import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { DeleteMock, EnableDomain, InitState, UpsertMock } from './actions';
import { IData, IState, IUpsertMock, requestMethod, requestType, IDeleteMock } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';

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
    const source: IData = OhMyState.findResponses(state, payload.url, payload.method, payload.type) || {
      url: payload.url,
      method: payload.method,
      type: payload.type,
      mocks: {}
    };
    debugger;

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

  @Action(DeleteMock)
  deleteResponse(ctx: StateContext<IState>, { payload }: { payload: IDeleteMock }) {
    const state = ctx.getState();
    const origMockResponses: IData = OhMyState.findResponses(state, payload.url, payload.method, payload.type);

    const mocks = { ...origMockResponses.mocks };
    delete mocks[payload.statusCode];

    const mockResponses = { ...origMockResponses, mocks};
    const index = state.data.indexOf(origMockResponses);

    const data = [...state.data];
    data[index] = mockResponses;

    ctx.setState({ ...state, data });
  }

  // NOTE: Without Responses it is currently not possible to go to the mock page
  // This update is only done on the mock page!
  // @Action(UpdateMock)
  // updateMock(ctx: StateContext<IState>, payload: IUpsertResponse) {
  //   const state = ctx.getState();
  //   const responses = OhMyState.findResponses(state, payload.url, payload.method, payload.type);

  //   if (!responses) {
  //     console.error('Error: Attempt to update mock, but it does not exist!', payload);
  //   }

  //   const index = state.responses.indexOf(responses);
  //   const mock = responses.mocks[payload.statusCode] || {};

  //   const newState = { ...state, responses: [...state.responses] };
  //   newState.responses[index] = {
  //     ...responses,
  //     mocks: {
  //       ...responses.mocks, [payload.statusCode]: {
  //         ...mock,
  //         dataType: payload.dataType,
  //         response: payload.response,
  //         mock: payload.mock
  //       }
  //     }
  //   };

  //   // console.log('STORE: state updates(newState)', state, responses);
  //   ctx.setState(newState);
  // }

  static findResponses(state: IState, url: string, method: requestMethod, type: requestType): IData | null {
    return state.data.find(r =>
      r.url === url && r.method === method && r.type === type) || null;
  }
}


