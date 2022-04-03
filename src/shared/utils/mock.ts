import { IMock, IOhMyMockSearch, IOhMyShallowMock, ohMyMockId } from '../type'
import { MOCK_JS_CODE, objectTypes } from '../constants';
import { uniqueId } from './unique-id';
import { timestamp } from './timestamp';

export class MockUtils {
  static init(base: Partial<IMock> = {}, update: Partial<IMock> = {}): IMock {
    const mock = {
      jsCode: MOCK_JS_CODE,
      delay: 0,
      headers: {},
      response: '{}',
      rules: [],
      statusCode: null,
      id: uniqueId(),
      createdOn: timestamp(),
      ...JSON.parse(JSON.stringify(base)),
      type: objectTypes.MOCK,
      modifiedOn: null,
      ...update
    };

    mock.responseMock ??= mock.response;
    mock.headersMock ??= mock.headers;

    return mock;
  }

  static clone(source: Partial<IMock>, updates?: Partial<IMock>): IMock {
    return this.init(source, { id: uniqueId(), ...updates });
  }

  static find(responses:Record<ohMyMockId, IOhMyShallowMock>, search: IOhMyMockSearch): IOhMyShallowMock | null {
    if (search.id) {
      return responses[search.id];
    }

    const output = Object.entries(responses).find(([k, v]) =>
      (!search.id || k === search.id) &&
      (!search.statusCode || search.statusCode === v.statusCode) &&
      (search.label === undefined || search.label === v.label || search.label === '' && v.label === undefined));

    return output ? responses[output[0]] : null;
  }

  static createShallowMock(mock: IOhMyShallowMock & Partial<IMock> | IMock): IOhMyShallowMock {
    return {
      id: mock.id,
      statusCode: mock.statusCode,
      ...(mock.label !== undefined && { label: mock.label }),
      ...(mock.modifiedOn && { modifiedOn: mock.modifiedOn})
    }
  }

  // static findActive(data: IData, scenar): IOhMyShallowMock | null {
  //   if (data.activeScenarioMock) {
  //     return data.mocks[data.activeScenarioMock];
  //   } else if (data.activeMock) {
  //     return data.mocks[data.activeMock];
  //   }

  //   return null;
  // }
}
