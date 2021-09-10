import { IData, IOhMyUpsertData, IState, ohMyDataId, ohMyMockId } from '../type';
import { compareUrls } from './urls';

export class StateUtils {
  static init(base: Partial<IState> = { }): IState {
    return { version: '-', views: { }, toggles: { }, data: { }, scenarios: { }, ...base } as IState;
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

  static findData(state: IState, search: IOhMyUpsertData, onlyActive = false): IData | null {
    const result = Object.entries(state.data).find(([k, v]: [ohMyDataId, IData]) => {
      return k === search.id || (
        (search.method && search === v.method) &&
        (search.requestType && search.requestType === v.requestType) &&
        (search.url && search.url === v.url || compareUrls(search.url, v.url))
      ) && (!onlyActive || v.enabled && (v.activeMock || v.activeScenarioMock))
    });

    return result ? { ...state.data[result[0]] } : null;

  }

  static getAllMockIds(state: IState): ohMyMockId[] {
    return Object.values(state.data).map(d => Object.keys(d.mocks))
      .reduce((acc, mocks) => [...acc, ...mocks])
  }
}
