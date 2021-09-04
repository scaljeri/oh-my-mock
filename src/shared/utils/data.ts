import { objectTypes } from '@shared/constants';
import { IData, IMock, IOhMyMock, IOhMyUpsertData, IState, ohMyDataId, ohMyDomain, ohMyMockId } from '../type';
import { StateUtils } from './state';
import { StorageUtils } from './storage';
import { uniqueId } from './unique-id';
import { compareUrls, url2regex } from './urls';

export class DataUtils {
  static StateUtils = StateUtils;
  static StorageUtils = StorageUtils;

  static get(state: IState, id: ohMyDataId): IData {
    return { ...state.data[id], mocks: { ...state.data[id].mocks } };
  }

  static init(data: Partial<IData>): IData {
    return {
      id: uniqueId,
      mocks: { },
      type: objectTypes.DATA,
      ...data
    } as IData;
  }

  static find(state, search: IOhMyUpsertData, onlyActive = true): IData | null {
    const result = Object.entries(state.data).find(([k, v]: [ohMyDataId, IData]) => {
      return k === search.id || (
        (search.method && search === v.method) &&
        (search.requestType && search.requestType === v.requestType) &&
        (search.url && search.url === v.url || compareUrls(search.url, v.url))
      ) && (!onlyActive || v.enabled && (v.activeMock || v.activeScenarioMock))
    });

    return result ? { ...state.data[result[0]] } : null;
  }

  static addMock = (state: IState, id: ohMyDataId, mock: IMock, activate = true): IData => {
    const data = { ...state.data[id] };
    data.mocks = { ...data.mocks, [mock.id]: { scenario: mock.scenario } };

    if (Object.keys(data.mocks).length === 1) {
      data.activeMock = mock.id;
    }

    return data;
  }

  static removeMock(store: IOhMyMock, domain: ohMyDomain, mockId: ohMyMockId, dataId: ohMyDataId): IData {
    const mocks = { ...store.content.mocks };
    delete mocks[mockId];

    const state = { ...store.domains[domain], data: store.domains[domain].data };
    const data = { ...state.data[dataId], mocks: state.data[dataId].mocks };
    delete data.mocks[mockId];


    const output = { ...(this.StateUtils.isState(data) ? data.data[dataId] : data) };
    output.mocks = { ...output.mocks };

    delete output.mocks[mockId];

    if (output.activeMock === mockId) {
      output.activeMock = null;
    }

    if (output.activeScenarioMock === mockId) {
      output.activeScenarioMock = null;
    }

    return output;
  }

  static enable(state: IState, id: ohMyDataId, enabled = true): IData {
    return { ...state.data[id], enabled };
  }

  static create(state: IState, data: Partial<IData>): IData {
    const output = {
      id: uniqueId(),
      enabled: false,
      mocks: { },
      ...data
    } as IData;

    if (!data.id) {
      output.url = url2regex(output.url);
    }

    return output;
  }
}
