import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { DeleteResponse, EnableDomain, InitState, StateReset, UpdateMock, UpsertResponse } from './actions';
import { IResponses, IState, IUpsertResponse, requestMethod, requestType, statusCode, IResponseMock, IDeleteResponse } from '@shared/type';
import { STORAGE_KEY } from '@shared/constants';

@State<IState>({
  name: STORAGE_KEY,
  defaults: {
    domain: '',
    responses: []
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

  @Action(UpsertResponse)
  upsertResponses(ctx: StateContext<IState>, { payload }: { payload: IUpsertResponse }) {
    const state = ctx.getState();
    const source: IResponses = OhMyState.findResponses(state, payload.url, payload.method, payload.type) || {
      url: payload.url,
      method: payload.method,
      type: payload.type,
      mocks: {}
    };

    const indexOf = state.responses.indexOf(source);
    const responses = [...state.responses];

    const updated = {
      ...source,
      mocks: {
        ...source.mocks,
        [payload.activeStatusCode]: {
          response: payload.response,
          dataType: payload.dataType
        }
      }
    };

    if (indexOf === -1) {
      responses.push(updated);
    } else {
      responses[indexOf] = updated;
    }
    console.log('STORE: state updates(upsert)', state, responses);
    ctx.setState({ ...state, responses });
  }

  @Action(DeleteResponse)
  deleteResponse(ctx: StateContext<IState>, { payload }: { payload: IDeleteResponse }) {
    const state = ctx.getState();
    const origMockResponses: IResponses = OhMyState.findResponses(state, payload.url, payload.method, payload.type);

    const mocks = { ...origMockResponses.mocks };
    delete mocks[payload.statusCode];

    const mockResponses = { ...origMockResponses, mocks};
    const index = state.responses.indexOf(origMockResponses);

    const responses = [...state.responses];
    responses[index] = mockResponses;

    ctx.setState({ ...state, responses });
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

  @Action(StateReset)
  reset(ctx: StateContext<IState>) {
    const state = ctx.getState();
    ctx.setState({ responses: [], domain: state.domain });
  }

  static findResponses(state: IState, url: string, method: requestMethod, type: requestType): IResponses | null {
    return state.responses.find(r =>
      r.url === url && r.method === method && r.type === type) || null;
  }
}


