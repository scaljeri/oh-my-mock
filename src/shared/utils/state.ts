import { IData, IOhMyUpsertData, IState, ohMyDataId, ohMyMockId, ohMyScenarioId } from '../type';
import { DataUtils } from './data';
import { compareUrls } from './urls';

export class StateUtils {
  static version = '__OH_MY_VERSION__';

  static init(base: Partial<IState> = {}): IState {
    return {
      version: this.version, views: {
        activity: []
      }, aux: {}, data: {}, scenarios: {}, context: {}, ...base
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

  static activateScenario(state: IState, scenario: ohMyScenarioId): IState {
    state = {
      ...state,
      context: { ...state.context, scenario }
    };

    return state;
  }
}
