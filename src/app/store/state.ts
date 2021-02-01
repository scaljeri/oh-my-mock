import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { EnableDomain, InitState, UpdateMock } from './actions';
import { IMock, IOhMyMock, IState } from './type';
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
      console.log('State#nodes');
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

  @Action(UpdateMock)
  updateMock(ctx: StateContext<IState>, { payload }: { payload: IMock }) {
    const state = ctx.getState();
    ctx.setState({ ...state, urls: {...state.urls, [payload.url]: payload }});
  }
}
