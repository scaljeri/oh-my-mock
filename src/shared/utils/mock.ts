import contentParser from 'content-type-parser';

import { IMock, IOhMyShallowMock, ohMyMockId, ohMyStatusCode } from '../type'
import { MOCK_JS_CODE } from '../constants';
import { uniqueId } from './unique-id';
import { timestamp } from './timestamp';

export interface IOhMyMockSearchOptions {
  statusCode?: ohMyStatusCode;
  scenario?: string;
  id?: ohMyMockId;
}

export class MockUtils {
  static init(base: Partial<IMock> = {}, update: Partial<IMock> = {}): IMock {
    const mock = {
      jsCode: MOCK_JS_CODE,
      delay: 0,
      headers: {},
      response: {},
      scenario: null,
      rules: [],
      statusCode: null,
      ...JSON.parse(JSON.stringify(base)),
      id: uniqueId(),
      createdOn: timestamp(),
      modifiedOn: null,
      ...update
    };

    mock.responseMock ??= mock.response;
    mock.headersMock ??= mock.headers;

    if (mock.headersMock) {
      const contentType = contentParser(mock.headersMock['content-type']);

      if (contentType) {
        mock.type = contentType.type;
        mock.subType = contentType.subtype;
      }
    }

    return mock;
  }

  static clone(source: Partial<IMock>, updates?: Partial<IMock>): IMock {
    return this.init(source, updates);
  }

  static find(mocks: Record<ohMyMockId, IMock>, searchOptions: IOhMyMockSearchOptions): IMock | void {
    if (searchOptions.id) {
      return mocks[searchOptions.id];
    } else {
      return Object.values(mocks).find(mock =>
        (!searchOptions.statusCode || searchOptions.statusCode === mock.statusCode) &&
        (!searchOptions.scenario || searchOptions.scenario === mock.scenario));
    }
  }

  static createShallowMock(mock: IOhMyShallowMock & Partial<IMock>): IOhMyShallowMock {
    return {
      id: mock.id,
      statusCode: mock.statusCode,
      ...(mock.scenario !== undefined && {scenario: mock.scenario})
    }
  }
}
