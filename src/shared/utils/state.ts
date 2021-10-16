import { IData, IOhMyPresetChange, IOhMyUpsertData, IState, ohMyDataId, ohMyMockId, ohMyPresetId } from '../type';
import { compareUrls } from './urls';

export class StateUtils {
  static version = '__OH_MY_VERSION__';

  static init(base: Partial<IState> = {}): IState {
    return {
      version: this.version, views: {
        activity: []
      }, aux: {}, data: {}, presets: { default: 'Default' }, context: {
        preset: 'default'
      }, ...base
    } as IState;
  }

  static isState<V = IData>(input: IState | V): input is IState {
    return (input as IState).domain !== undefined;
  }

  static getData(state: IState, id: ohMyDataId): IData {
    return { ...state.data[id] };
  }

  static setData(state: IState, data: IData): IState {
    return { ...state, data: { ...state.data, [data.id]: data } };
  }

  static removeData(state: IState, id: ohMyDataId): IData {
    const data = state.data[id];

    state.data = { ...state.data };
    delete state.data[id];

    return data;
  }

  // static removeMock(state: IState, mockId: ohMyMockId, dataId: ohMyDataId): IState {
  //   const data = { ...state.data[dataId], mocks: { ...state.data[dataId].mocks } };
  //   delete data.mocks[mockId];

  //   return { ...state, data: { ...state.data, [dataId]: data } };
  // }

  static findData(state: IState, search: IOhMyUpsertData): IData | undefined {
    const result = Object.values(state.data).find(v => {
      return (
        (!search.id || v.id === search.id) &&
        (!search.method || search.method === v.method) &&
        (!search.requestType || search.requestType === v.requestType) &&
        (!search.url || search.url === v.url || compareUrls(search.url, v.url))
      )
    });

    return result ? { ...result } : undefined;
  }

  static getAllMockIds(state: IState): ohMyMockId[] {
    return Object.values(state.data).map(d => Object.keys(d.mocks))
      .reduce((acc, mocks) => [...acc, ...mocks])
  }

  static activateScenario(state: IState, preset: ohMyPresetId): IState {
    state = {
      ...state,
      context: { ...state.context, preset }
    };

    return state;
  }

  static updatePreset(state: IState, update: IOhMyPresetChange): IState {
    if (!update.value) {
      return state;
    }

    state.presets = { ...state.presets };
    state.data = { ...state.data };

    if (update.delete) {
      // Cannot delete last preset
      if (Object.keys(state.presets).length === 1) {
        return state;
      }

      delete state.presets[update.id];
      Object.values(state.data).map(d => ({ ...d })).forEach(data => {
        delete data.enabled[update.id]
        delete data.presets[update.id];

        state.data[data.id] = data;
      });

      if (state.context.preset === update.id) {
        state.context.preset = 'default';
      }
    } else {
      state.presets[update.id] = update.value;

      if (!state.presets[update.id]) { // new preset
        Object.values(state.data).map(d => ({ ...d })).forEach(data => {
          delete data.enabled[update.id]
          delete data.presets[update.id];

          state.data[data.id] = data;
        });
      } else {
        state.presets[update.id] = update.value;
      }

      if (update.activate) {
        state.context.preset = update.id;
      }
    }

    return state;
  }
}
