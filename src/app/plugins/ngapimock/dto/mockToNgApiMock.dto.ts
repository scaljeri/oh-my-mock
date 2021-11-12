import { IData, IMock } from '../../../../shared/type';
import { Mock } from '@ng-apimock/core/dist/mock/mock';
import { MockResponse } from '@ng-apimock/core/dist/mock/mock.response';
export default function mockToNgApiMock(mock: IData, name: string): Mock {
  const responses: Record<string, MockResponse> = {};

  Object.keys(mock.mocks).forEach((statusCode) => {
    // const oriMockResponse: IMock = mock.mocks[statusCode];
    // responses[statusCode] = {
    //   status: Number(statusCode),
    //   data: oriMockResponse.responseMock ? JSON.parse(oriMockResponse.responseMock) : ''
    // };
  });

  return {
    name,
    path: mock.url,
    responses,
    request: {
      url: mock.url,
      method: mock.method
    }
  };
}
