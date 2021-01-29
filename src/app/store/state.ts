import { State, Action, StateContext, Selector, createSelector } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { EnableDomain } from './actions';
import { IState } from './type';

@State<IState>({
  name: 'OhMyState',
  defaults: {
    domain: '',
    urls: {}
  }
})
@Injectable()
export class OhMyState {
  private domain = this.window.location.hostname;;
  constructor(private window: Window) { }

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

  // @Selector([FbpState.nodes])
  // static nodexx(nodeId: string) {
  //     return createSelector([FbpState], (state: IFbpState) => {
  //         // const outNode = state.nodes.filter(node => node.id === nodeId)[0];
  //         // console.log('State#getNode#createSelector', nodeId, outNode, state);
  //         return state.nodes![nodeId]; // outNode;
  //     });
  // }
  // @Selector()
  // static get(state: IFbpState) {
  //     return state;
  // }

  @Action(EnableDomain)
  enable(ctx: StateContext<IState>, { payload }: { payload: boolean }) {
    if (!this.domain) {
      return;
    }

    if (chrome) {
      const query = { active: true, currentWindow: true };
      chrome.tabs.query(query, tabs => {
        const domain = tabs[0].url.match(/^https?:\/\/[^/]+/)[0];

        chrome.storage.sync.get('oh-my-mocks', function (data: Record<string, IState> = {}) {
          const state = data[domain] || { urls: {}, domain };
          state.enabled = payload;
          data = { ...data, domains: { ...data.domains, [this.domain]: state } };

          chrome.storage.sync.set(data, () => {
            ctx.setState(state);
          });
        });
      });
    }
  }

  // @Action(NodeCoordinates)
  // updateNodeCoordinates(ctx: StateContext<IFbpState>, { payload }: { payload: NodeCoordinate }) {
  //     const state = ctx.getState();
  //     const nodes = state.nodes;
  //     const node = { ...nodes![payload.id], ...{ position: payload.position } };
  //     // const node = state.nodes[payload.id]; // .find(n => n.id === payload.id);
  //     ctx.patchState({ nodes: { ...nodes, [payload.id]: node } });
  //     // const index = state.nodes.indexOf(node);

  //     // const nodes = [...state.nodes];
  //     // nodes[index] = { ...node, ...{ position: payload.position } };

  //     // console.log('UPDTAE!!!!!', payload, state);
  //     // const s = { ...state };
  //     // s[payload.id] = { ...s[payload.id], ...{ position: payload.position}};
  //     // ctx.patchState({ nodes });
  //     // state.nodes[index] = { ...node, ...{ position: payload.position } };
  //     // ctx.patchState({ nodes });
  //     // ctx.setState({ ...state, ...{[payload.id]: node}});
  //     // ctx.setState(s);
  // }

  // @Action(Decrement)
  //    decrement(ctx: StateContext<number>) {
  //    ctx.setState(ctx.getState() - 1);
  //  }
}
