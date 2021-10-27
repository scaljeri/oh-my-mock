import contentParser from 'content-type-parser';

import { IMock, IOhMyMockSearch, IOhMyShallowMock, ohMyMockId } from '../type'
import { MOCK_JS_CODE, objectTypes } from '../constants';
import { uniqueId } from './unique-id';
import { timestamp } from './timestamp';

// export interface IOhMyMockSearchOptions {
//   statusCode?: ohMyStatusCode;
//   label?: string;
//   id?: ohMyMockId;
// }

export class MockUtils {
  static init(base: Partial<IMock> = {}, update: Partial<IMock> = {}): IMock {
    const mock = {
      jsCode: MOCK_JS_CODE,
      delay: 0,
      headers: {},
      response: {},
      rules: [],
      statusCode: null,
      ...JSON.parse(JSON.stringify(base)),
      id: uniqueId(),
      createdOn: timestamp(),
      type: objectTypes.MOCK,
      modifiedOn: null,
      ...update
    };

    mock.responseMock ??= mock.response;
    mock.headersMock ??= mock.headers;

    return mock;
  }

  static clone(source: Partial<IMock>, updates?: Partial<IMock>): IMock {
    return this.init(source, updates);
  }

  static find(mocks: Record<ohMyMockId, IMock>, searchOptions: IOhMyMockSearch): IMock | void {
    if (searchOptions.id) {
      return mocks[searchOptions.id];
    } else {
      return Object.values(mocks).find(mock =>
        (!searchOptions.statusCode || searchOptions.statusCode === mock.statusCode) &&
        (!searchOptions.label || searchOptions.label === mock.label));
    }
  }

  static createShallowMock(mock: IOhMyShallowMock & Partial<IMock>): IOhMyShallowMock {
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
