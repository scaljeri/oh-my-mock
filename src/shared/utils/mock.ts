import { IOhMyResponse, IOhMyMockResponse, IOhMyResponseSearch, IOhMyShallowResponse, IOhMyResponseId } from '../types'
import { MOCK_JS_CODE, objectTypes, OhMyResponseStatus } from '../constants';
import { uniqueId } from './unique-id';
import { timestamp } from './timestamp';

export class MockUtils {
  static init(base: Partial<IOhMyResponse> = {}, update: Partial<IOhMyResponse> = {}): IOhMyResponse {
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
      type: objectTypes.RESPONSE,
      modifiedOn: null,
      ...update
    };

    mock.responseMock ??= mock.response;
    mock.headersMock ??= mock.headers;

    return mock;
  }

  static clone(source: Partial<IOhMyResponse>, updates?: Partial<IOhMyResponse>): IOhMyResponse {
    return this.init(source, { id: uniqueId(), ...updates });
  }

  static find(responses: Record<IOhMyResponseId, IOhMyShallowResponse>, search: IOhMyResponseSearch): IOhMyShallowResponse | null {
    if (search.id) {
      return responses[search.id];
    }

    const output = Object.entries(responses).find(([k, v]) =>
      (!search.id || k === search.id) &&
      (!search.statusCode || search.statusCode === v.statusCode) &&
      (search.label === undefined || search.label === v.label || search.label === '' && v.label === undefined));

    return output ? responses[output[0]] : null;
  }

  static createShallowMock(mock: IOhMyShallowResponse & Partial<IOhMyResponse> | IOhMyResponse): IOhMyShallowResponse {
    return {
      id: mock.id,
      statusCode: mock.statusCode,
      ...(mock.label !== undefined && { label: mock.label }),
      ...(mock.modifiedOn && { modifiedOn: mock.modifiedOn })
    }
  }

  static mockToResponse(mock?: IOhMyResponse): IOhMyMockResponse {
    if (mock) {
      return {
        status: OhMyResponseStatus.OK,
        response: mock.responseMock,
        headers: mock.headersMock,
        delay: mock.delay,
        statusCode: mock.statusCode
      } as IOhMyMockResponse;
    } else {
      return { status: OhMyResponseStatus.NO_CONTENT }
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
