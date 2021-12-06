import { IData } from '../../../../shared/type';
import { Mock } from '@ng-apimock/core/dist/mock/mock';
import mockToNgApiMock from './mockToNgApiMock.dto';
import { objectTypes } from '@shared/constants';

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
      id: 'asd',
      url: 'some/url',
      type: objectTypes.REQUEST,
      selected: {},
      enabled: {},
      requestType: 'XHR',
      method: 'GET',
      lastHit: 123,
      mocks: {
        '200': {
          id: '200',
          statusCode: 200,
        }
      }
    } as any;
  });
  xit('should transform', () => {
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
