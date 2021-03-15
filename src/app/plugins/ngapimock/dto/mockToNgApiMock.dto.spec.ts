import { IData } from '../../../../shared/type';
import { Mock } from '@ng-apimock/core/dist/mock/mock';
import mockToNgApiMock from './mockToNgApiMock.dto';

const aMockResponse = {
  data: {
    some: 'satastructure',
    with: [
      {
        an: 'objectinanarray'
      }
    ]
  }
};
describe('mockToNgApiMock', () => {
  let ohMyMockMock: IData;
  beforeEach(() => {
    ohMyMockMock = {
      url: 'some/url',
      method: 'XHR',
      type: 'GET',
      activeStatusCode: 200,
      mocks: {
        200: {
          responseMock: JSON.stringify(aMockResponse)
        }
      }
    };
  });
  it('should transform', () => {
    const transformedMock: Mock = {
      name: 'somename',
      path: 'some/url',
      responses: {
        200: {
          data: aMockResponse,
          status: 200
        }
      },
      request: {
        method: 'GET',
        url: 'some/url'
      }
    };
    expect(mockToNgApiMock(ohMyMockMock, 'somename')).toEqual(transformedMock);
  });
});
