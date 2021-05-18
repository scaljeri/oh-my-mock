import { StateContext } from '@ngxs/store';
import { IOhMyMock, IData, IMock, ohMyMockId, IState } from '@shared/type';
import { MOCK_JS_CODE } from '@shared/constants';
import { OhMyState } from './state';

import { testDataMock } from '@shared/test-site.mocks';

describe('Store#upsertMock', () => {
  let state: IOhMyMock;
  let store: OhMyState;
  let ctx: StateContext<IOhMyMock>;
  let update: IOhMyMock;
  let data: IData;
  let mock: IMock;
  let mockId: ohMyMockId

  beforeEach(() => {
    OhMyState.domain = 'localhost';
    store = new OhMyState();

    state = {
      domains: { 'localhost': { domain: 'test', data: [], views: {}, toggles: {} } }, version: '2.0.0'
    }

    ctx = {
      getState: () => state,
      dispatch: jest.fn(),
      setState: jest.fn()
    } as any
  });

  describe('new', () => {
    beforeEach(() => {
      store.upsertMock(ctx, {
        payload: {
          url: 'url', method: 'GET', type: 'XHR',
          mock: { id: 'id', statusCode: 1, response: 'r', headers: { 'content-type': 'application/json' } }
        }, domain: 'localhost'
      });
    });

    describe('data', () => {
      it('should upsert/dispatch', () => {
        expect(ctx.dispatch).toHaveBeenCalledWith({
          domain: 'localhost',
          payload: {
            url: 'url',
            id: (expect as any).anything(),
            method: 'GET',
            type: 'XHR',
            mocks: (expect as any).anything(),
            activeMock: null
          }
        });
      });
    });

    describe('mock', () => {
      it('should be added to the data\'s upsert/dispatch', () => {
        const payload = (ctx.dispatch as any).mock.calls[0][0].payload;
        const mockId = Object.keys(payload.mocks)[0];

        const mock = {
          id: mockId,
          createdOn: (expect as any).anything(),
          delay: 0,
          jsCode: MOCK_JS_CODE,
          statusCode: 1,
          response: 'r',
          responseMock: 'r',
          headers: { 'content-type': 'application/json' },
          headersMock: { 'content-type': 'application/json' },
          type: 'application',
          subType: 'json'
        }

        expect(payload.mocks[mockId]).toEqual(mock);
        expect(new Date(payload.mocks[mockId].createdOn).getTime() > (Date.now() - 1000)).toBeTruthy();
      });
    });
  });

  describe('update', () => {
    beforeEach(() => {
      ctx.getState = () => ({ version: '2.0.0', domains: { 'localhost': testDataMock } })
    })
    it('should set the modifiedOn property', () => {
      store.upsertMock(ctx, { payload: { id: 'SAidn6Y3nP', mock: { id: 'GvpQ5ZCIvv', responseMock: 'new' } }, domain: 'localhost' })
      update = (ctx.setState as any).mock.calls[0][0];
      mock = update.domains.localhost.data[0].mocks['GvpQ5ZCIvv'];

      expect(mock.modifiedOn).toBeDefined();
      expect(mock.responseMock).toBe('new');
      expect(mock.responseMock !== mock.response).toBeTruthy();
    });

    describe('Clone', () => {
      beforeEach(() => {
        store.upsertMock(ctx, { payload: { clone: true, id: 'SAidn6Y3nP', mock: { response: 'new' } }, domain: 'localhost' })
        update = (ctx.setState as any).mock.calls[0][0];
        data = update.domains.localhost.data[0];
        mockId = Object.keys(data.mocks).filter(k => k !== 'GvpQ5ZCIvv')[0];
        mock = data.mocks[mockId];
      });

      it('should clone the statusCode', () => {
        expect(mock.statusCode).toBe(data.mocks['GvpQ5ZCIvv'].statusCode);
      });

      it('should not clone the created date', () => {
        expect(mock.createdOn).not.toBe(data.mocks['GvpQ5ZCIvv'].createdOn);
      });

      it('should keep the provided response', () => {
        expect(mock.response).not.toBe(data.mocks['GvpQ5ZCIvv'].response);
      });

      it('should not make the cloned mock active', () => {
        expect(data.activeMock).not.toBe(mockId);
      });
    });

    describe('Make active', () => {
      beforeEach(() => {
        store.upsertMock(ctx, { payload: { makeActive: true, id: 'SAidn6Y3nP', mock: { response: 'new' } }, domain: 'localhost' })
        update = (ctx.setState as any).mock.calls[0][0];
        data = update.domains.localhost.data[0];
        mockId = Object.keys(data.mocks).filter(k => k !== 'GvpQ5ZCIvv')[0];
        mock = data.mocks[mockId];
      });

      it('should update the active mock id', () => {
        expect(data.activeMock).toBe(mockId);
      });
    });
  });
});
