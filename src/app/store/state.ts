import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { EnableDomain, InitState, StateReset, UpdateMock, UpdateResponse } from './actions';
import { IOhMyMock, IResponses, IState, IUpdateResponse, requestMethod, requestType } from './type';
import { STORAGE_KEY } from '../types';

@State<IOhMyMock>({
  name: STORAGE_KEY,
  defaults: {
    domains: {}
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
    console.log('State#nodes', state);
    return state;
  }

  @Action(InitState)
  init(ctx: StateContext<IState>, { payload }: { payload: IState }) {
    ctx.setState(payload);
  }

  @Action(EnableDomain)
  enable(ctx: StateContext<IState>, { payload }: { payload: boolean }) {
    const state = ctx.getState();
    console.log('state updates');
    ctx.setState({ ...state, enabled: payload });
  }

  @Action(UpdateResponse)
  updateResponses(ctx: StateContext<IState>, { payload }: { payload: IUpdateResponse }) {
    const state = ctx.getState();
    const responses = OhMyState.findResponses(state, payload.url, payload.method, payload.responseType) || {
      url: payload.url,
      method: payload.method,
      type: payload.responseType,
      data: {}
    };

    responses[payload.status].data = { ...responses[payload.status].data, dataType: payload.dataType, data: payload.data };
    ctx.setState({ ...state, responses: [...state.responses, responses] });
  }

  // NOTE: Without Responses it is currently not possible to go to the mock page
  // This update is only done on the mock page!
  @Action(UpdateMock)
  updateMock(ctx: StateContext<IState>, payload) {
    const state = ctx.getState();
    const responses = OhMyState.findResponses(state, payload.url, payload.method, payload.responseType);
    const index = state.responses.indexOf(responses);
    const newState = { ...state, responses: [...state.responses] };
    newState.responses[index] = { ...responses, mocks: {...responses.mocks, [payload.status]: payload.mock} };

    ctx.setState(newState);
  }

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


