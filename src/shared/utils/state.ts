import { objectTypes } from '../constants';
import { timestamp } from 'rxjs';
import { IData, IOhMyUpsertData, IState, ohMyDataId, ohMyMockId, ohMyPresetId } from '../type';
import { compareUrls } from './urls';

export class StateUtils {
  static version = '__OH_MY_VERSION__';

  static init(base: Partial<IState> = {}): IState {
    return {
      version: this.version,
      views: { activity: [] },
      aux: { newAutoActivate: true }, data: {}, presets: { default: 'Default' },
      context: {
        preset: 'default',
        domain: base.domain
      },
      ...base,
      type: objectTypes.STATE,
      onModified: timestamp()
    } as IState;
  }

  static isState(input: unknown): input is IState {
    return (input as IState).type === objectTypes.STATE;
  }

  static getRequest(state: IState, id: ohMyDataId): IData | undefined {
    const retVal = state.data[id];
    return retVal ? { ...retVal } : undefined;
  }

  static setRequest(state: IState, data: IData): IState {
    return { ...state, data: { ...state.data, [data.id]: data } };
  }

  static removeRequest(state: IState, id: ohMyDataId): IData {
    const data = state.data[id];

    state.data = { ...state.data };
    delete state.data[id];

    return data;
  }

  static findRequest(state: IState, search: IOhMyUpsertData): IData | undefined {
    const result = Object.values(state.data).find(v => {
      return (
        (search.id && v.id === search.id) || !search.id &&
        (!search.method || search.method === v.method) &&
        (!search.requestType || search.requestType === v.requestType) &&
        (!search.url || search.url === v.url || compareUrls(search.url, v.url))
      )
    });

    return result ? { ...result } : undefined;
  }

  // static getAllResponseIds(state: IState): ohMyMockId[] {
  //   return Object.values(state.data).map(d => Object.keys(d.mocks))
  //     .reduce((acc, mocks) => [...acc, ...mocks], []);
  // }

  // static activateScenario(state: IState, preset: ohMyPresetId): IState {
  //   state = {
  //     ...state,
  //     context: { ...state.context, preset }
  //   };

  //   return state;
  // }

  // static updatePreset(state: IState, update: IOhMyPresetChange): IState {
  //   if (!update.value) {
  //     return state;
  //   }

  //   state.presets = { ...state.presets };
  //   state.data = { ...state.data };

  //   if (update.delete) {
  //     // Cannot delete last preset
  //     if (Object.keys(state.presets).length === 1) {
  //       return state;
  //     }

  //     delete state.presets[update.id];
  //     Object.values(state.data).map(d => ({ ...d })).forEach(data => {
  //       delete data.enabled[update.id]
  //       delete data.selected[update.id];

  //       state.data[data.id] = data;
  //     });

  //     if (state.context.preset === update.id) {
  //       state.context.preset = 'default';
  //     }
  //   } else {
  //     state.presets[update.id] = update.value;

  //     if (!state.presets[update.id]) { // new preset
  //       Object.values(state.data).map(d => ({ ...d })).forEach(data => {
  //         delete data.enabled[update.id]
  //         delete data.selected[update.id];

  //         state.data[data.id] = data;
  //       });
  //     } else {
  //       state.presets[update.id] = update.value;
  //     }

  //     if (update.activate) {
  //       state.context.preset = update.id;
  //     }
  //   }

  //   return state;
  // }

  // static async cloneRequests(state: IState, requests: Partial<IData> | Partial<IData>[]): Promise<IState> {
  //   if (!Array.isArray(requests)) {
  //     requests = [requests];
  //   }

  //   for (const r of requests) {
  //     const data = { ...(this.findRequest(state, r) || DataUtils.init(r)) };

  //     const entries = Object.values(r.mocks);

  //     for (const e of entries) {
  //       const respData = await StorageUtils.get<IMock>(e[0]);
  //       respData.id = uniqueId();
  //       await StorageUtils.set(respData.id, respData);
  //       data.mocks[respData.id] = MockUtils.createShallowMock(respData);
  //     }

  //     state = StateUtils.setRequest(state, data);
  //   }

  //   await StorageUtils.set(state.domain, state);

  //   return state;
  // }
}
