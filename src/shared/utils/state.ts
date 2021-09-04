import { IData, IState, ohMyDataId, ohMyMockId } from '../type';

export class StateUtils {
  static init(base: Partial<IState> = { }): IState {
    return { views: { }, toggles: { }, data: { }, scenarios: { }, ...base } as IState;
  }

  static isState<V = IData>(input: IState | V): input is IState {
    return (input as IState).domain !== undefined;
  }

  static getData(state: IState, id: ohMyDataId): IData {
    return state.data[id];
  }

  static setData(state: IState, data: IData): IState {
    return { ...state, data: {...state.data, [data.id]: data}};
  }

  static removeData(state: IState, id: ohMyDataId): IState | null {
    const update = { ...state, data: { ...state.data } };
    delete update.data[id];

    return update;
  }

  static removeMock(state: IState, mockId: ohMyMockId, dataId: ohMyDataId): IState {
    const data = { ...state.data[dataId], mocks: { ...state.data[dataId].mocks } };
    delete data.mocks[mockId];

    return { ...state, data: { ...state.data, [dataId]: data } };
  }
}
