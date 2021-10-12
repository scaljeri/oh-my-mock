import { IData, IMock, IOhMyMockSearch, IOhMyShallowMock, IOhMyContext, ohMyMockId, ohMyScenarioId } from '../type';
import { StorageUtils } from './storage';
import { uniqueId } from './unique-id';
import { url2regex } from './urls';

export class DataUtils {
  static StorageUtils = StorageUtils;

  // static get(state: IState, id: ohMyDataId): IData {
  //   return { ...state.data[id], mocks: { ...state.data[id].mocks } };
  // }

  static init(data: Partial<IData>): IData {
    return this.create(data);
  }

  static getActiveMock(data: IData, scenario: ohMyScenarioId = null): IOhMyShallowMock | undefined {
    if (data.enabled[scenario]) {
      return data.mocks[data.scenarios[scenario]];
    }

    return undefined;
  }

  static isScenarioActive(data: IData, scenario: ohMyScenarioId): boolean {
    return data.enabled[scenario];
  }

  static hasActiveMock(data: IData, scenario: ohMyScenarioId): boolean {
    return !!data.scenarios[scenario];
  }

  static findMock(data: IData, search: IOhMyMockSearch): IOhMyShallowMock | null {
    if (search.id) {
      return data.mocks[search.id];
    }

    const [id,] = Object.entries(data.mocks).find(([k, v]) =>
      (!search.id || k === search.id) &&
      (!search.statusCode || search.statusCode === v.statusCode) &&
      (!search.label || search.label === v.label));

    return id ? data.mocks[id] : null;
  }

  static addMock = (context: IOhMyContext, data: IData, mock: IMock, autoActivate = true): IData => {
    data = {
      ...data, mocks:
      {
        ...data.mocks, [mock.id]: {
          id: mock.id,
          statusCode: mock.statusCode,
          label: mock.label
        }
      }, scenarios: { ...data.scenarios, [context.preset]: mock.id },
      enabled: { ...data.enabled, [context.preset]: autoActivate }
    };

    return data;
  }

  static removeMock(context: IOhMyContext, data: IData, mockId: ohMyMockId): IData {
    data = {
      ...data,
      scenarios: { ...data.scenarios },
      enabled: { ...data.enabled },
      mocks: { ...data.mocks }
    };
    const mock = data.mocks[mockId];
    delete data.mocks[mockId];
    delete data.scenarios[context.preset];
    delete data.enabled[context.preset];

    const nextActiveMock = Object.values(data.mocks).sort(this.statusCodeSort)?.[0]

    if (nextActiveMock) {
      data.scenarios[context.preset] = nextActiveMock.id;
      data.enabled[context.preset] = false;
    }

    return data;
  }

  static activateMock(context: IOhMyContext, data: IData, mockId: ohMyMockId, scenario = null): IData {
    data = { ...data, scenarios: { ...data.scenarios }, enabled: { ...data.enabled } };

    data.scenarios[scenario] = mockId;
    data.enabled[scenario] = true;

    return data;
  }

  // static activeMockByScenario(data: IData, scenario: ohMyScenarioId, force = false): IData {
  //   const copy = { ...data };
  //   const result = Object.values(data.mocks).sort(this.statusCodeSort).find(v => v.scenario === scenario);

  //   if (result && (force || !data.activeMock[scenario])) {
  //     data.activeMock = { ...data.activeMock, [scenario]: result.id };
  //     data.isEnabled = { ...data.isEnabled, [scenario]: true };
  //   }

  //   return copy;
  // }

  static deactivateMock(context: IOhMyContext, data: IData): IData {
    data = { ...data, enabled: { ...data.enabled, [context.preset]: false } };

    return data
  }

  static create(data: Partial<IData>): IData {
    const output = {
      id: uniqueId(),
      isEnabled: {},
      activeMock: {},
      mocks: {},
      ...data
    } as IData;

    if (!data.id) {
      output.url = url2regex(data.url);
    }

    return output;
  }

  static statusCodeSort(a, b) {
    return a.statusCode === b.statusCode ? 0 : a.statusCode > b.statusCode ? 1 : -1;
  }
}
