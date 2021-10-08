import { objectTypes } from '../constants';
import { IData, IMock, IOhMyMockSearch, IOhMyShallowMock, ohMyMockId, ohMyScenarioId } from '../type';
import { StorageUtils } from './storage';
import { uniqueId } from './unique-id';
import { url2regex } from './urls';

export class DataUtils {
  static StorageUtils = StorageUtils;

  // static get(state: IState, id: ohMyDataId): IData {
  //   return { ...state.data[id], mocks: { ...state.data[id].mocks } };
  // }

  static init(data: Partial<IData>): IData {
    return {
      id: uniqueId(),
      mocks: {},
      type: objectTypes.DATA,
      ...data
    } as IData;
  }

  static getActiveMock(data: IData, mocks?: IMock[]): IMock | IOhMyShallowMock | null {
    const list = mocks || data.mocks;

    return mocks[data.activeScenarioMock || data.activeMock || ''] as IMock;
  }

  static hasActiveMock(data: IData): boolean {
    return !!(data.activeScenarioMock || data.activeMock);
  }

  static findMock(data: IData, search: IOhMyMockSearch, mocks?: Record<ohMyMockId, IMock>): IMock | IOhMyShallowMock | null {
    if (search.id) {
      return mocks ? mocks[search.id] : data.mocks[search.id];
    }

    const [id,] = Object.entries(data.mocks).find(([k, v]) =>
      (!search.id || k === search.id) &&
      (!search.statusCode || search.statusCode === v.statusCode) &&
      (!search.scenario || search.scenario === v.scenario));

    return id ? (mocks ? mocks[id] : data.mocks[id]) : null;
  }

  static addMock = (data: IData, mock: IMock): IData => {
    data.mocks = {
      ...data.mocks, [mock.id]: {
        id: mock.id,
        statusCode: mock.statusCode,
        scenario: mock.scenario
      }
    };

    // No active mock

    return data;
  }

  static removeMock(data: IData, mockId: ohMyMockId): IData {
    if (data.activeScenarioMock === mockId) {
      data.activeScenarioMock = null;
    }

    if (data.activeMock === mockId) {
      data.activeMock = null;
    }

    data.mocks = { ...data.mocks };
    delete data.mocks[mockId];

    return data;
  }

  static activateMock(data: IData, mockId: ohMyMockId, isScenario = false): IData {
    if (isScenario) {
      data.activeScenarioMock = mockId;
    } else {
      data.activeMock = mockId;
      data.activeScenarioMock = null;
    }

    return data;
  }

  static activeMockByScenario(data: IData, scenario: ohMyScenarioId): IData {
    const copy = { ...data };
    const result = Object.entries(data.mocks).find(([k, v]) => {
      return v.scenario === scenario
    }) || [];

    copy.activeScenarioMock = result[0]

    return copy;
  }

  static deactivateMock(data: IData, isScenario = false): IData {
    if (isScenario) {
      data.activeScenarioMock = null;
    } else {
      data.activeMock = null;
      data.activeScenarioMock = null;
    }

    return data
  }

  static create(data: Partial<IData>): IData {
    const output = {
      id: uniqueId(),
      enabled: false,
      mocks: {},
      ...data
    } as IData;

    if (!data.id) {
      output.url = url2regex(data.url);
    }

    return output;
  }
}
