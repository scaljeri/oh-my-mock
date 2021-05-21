import { StateContext } from '@ngxs/store';
import { IOhMyMock, IData, IMock, ohMyMockId, IState } from '@shared/type';
import { MOCK_JS_CODE } from '@shared/constants';
import { OhMyState } from './state';

import { testDataMock } from '@shared/test-site.mocks';
import { createNewMock } from './create-mock';

describe('#createMock', () => {
  let data: IData;
  let mock: IMock;

  describe('new mock', () => {
    beforeEach(() => {
      const data = testDataMock.data[0];
      mock = createNewMock({ response: 'x', headers: { 'content-type': 'a/b' } }, data, false);
    });

    it('should initialize', () => {
      expect(mock).toEqual({
        jsCode: MOCK_JS_CODE,
        delay: 0,
        id: (expect as any).anything(),
        createdOn: (expect as any).anything(),
        response: 'x',
        responseMock: 'x',
        headers: { 'content-type': 'a/b' },
        headersMock: { 'content-type': 'a/b' },
        type: 'a',
        subType: 'b'
      });
    });

    it('should have a created date', () => {
      expect(new Date(mock.createdOn).getTime() > Date.now() - 1000).toBeTruthy();
    });
  });

  describe('clone active', () => {
    beforeEach(() => {
      data = testDataMock.data[0];
      mock = createNewMock({ response: 'x', headers: { 'content-type': 'a/b' } }, data, true);
    });

    it('should have a statusCode', () => {
      expect(mock.statusCode).toBe(409);
    });

    it('should update the response', () => {
      expect(mock.response).toBe('x');
      expect(mock.response).not.toBe(mock.responseMock);
    });

    it('should have a unique id', () => {
      expect(mock.id).not.toBe(data.activeMock);
    });

    it('should not clone the response because it is provided', () => {
      expect(mock.response).toBe('x');
    });

    it('should not have a modified date', () => {
      expect(mock.modifiedOn).not.toBeDefined();
    });
  });

  describe('update existing mock', () => {
    beforeEach(() => {
      const data = testDataMock.data[0];
      mock = createNewMock({ id: 'GvpQ5ZCIvv', response: 'x', headers: { 'content-type': 'a/b' } }, data, false);
    });

    it('should have a statusCode', () => {
      expect(mock.statusCode).toBe(409);
    });

    it('should update the response', () => {
      expect(mock.response).toBe('x');
      expect(mock.response).not.toBe(mock.responseMock);
    });
  });
});

