import { StateContext } from '@ngxs/store';
import { IOhMyMock, IData, IMock, ohMyMockId } from '@shared/type';
import { OhMyState } from './state';

import { testDataMock } from '@shared/test-site.mocks';

describe('Store#upsertMock', () => {
  let state: IOhMyMock;
  let store: OhMyState;
  let ctx: StateContext<IOhMyMock>;
  let update;
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
          mock: { statusCode: 1, response: 'r', headers: { 'content-type': 'application/json' } }
        }, domain: 'localhost'
      });
      update = (ctx.dispatch as any).mock.calls[0][0];
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
            activeMock: (expect as any).anything()
          }
        });
      });

      it('should contain the new mock', () => {
        mockId = Object.keys(update.payload.mocks)[0];
        mock = update.payload.mocks[mockId];

        expect(mock.statusCode).toBe(1);
      });
    });
  });

  describe('Make Active', () => {
    beforeEach(() => {
      ctx.getState = () => ({ version: '2.0.0', domains: { 'localhost': testDataMock } })
    })
    describe('makeActive is set to true', () => {
      beforeEach(() => {
        store.upsertMock(ctx, {
          payload:
            { makeActive: true, id: 'SAidn6Y3nP', mock: { response: 'new' } }, domain: 'localhost'
        })
        update = (ctx.setState as any).mock.calls[0][0];
        data = update.domains.localhost.data[0];
        mockId = Object.keys(data.mocks).filter(k => k !== 'GvpQ5ZCIvv')[0];
        mock = data.mocks[mockId];
      });

      it('should update the active mock id', () => {
        expect(data.activeMock).toBe(mockId);
      });
    });

    describe('the makeActive toggle is set to true', () => {
      beforeEach(() => {
        ctx.getState = () => ({
          version: '2.0.0', domains: {
            'localhost':
              { ...testDataMock, toggles: { activateNew: true } }
          }
        });
        store.upsertMock(ctx, {
          payload:
            { makeActive: true, id: 'SAidn6Y3nP', mock: { response: 'new' } }, domain: 'localhost'
        })
        update = (ctx.setState as any).mock.calls[0][0];
        data = update.domains.localhost.data[0];
        mockId = Object.keys(data.mocks).filter(k => k !== 'GvpQ5ZCIvv')[0];
        mock = data.mocks[mockId];
      });

      it('should update the active mock id', () => {
        expect(data.activeMock).toBe(mockId);
      })
    });
  });
});
