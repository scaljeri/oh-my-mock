import { StateContext } from '@ngxs/store';
import { IOhMyMock, IData } from '@shared/type';
import { MOCK_JS_CODE } from '@shared/constants';
import { UpsertData } from './actions';
import { OhMyState } from './state';

import { testDataMock } from '@shared/test-site.mocks';

describe('Store#upsertMock', () => {
  let state: IOhMyMock;
  let store: OhMyState;
  let ctx: StateContext<IOhMyMock>;

  beforeEach(() => {
    OhMyState.domain = 'localhost';
    store = new OhMyState();
  });

  describe('new', () => {
    beforeEach(() => {
      state = {
        domains: { 'localhost': { domain: 'test', data: [], views: {}, toggles: {} } }, version: '2.0.0'
      };
      ctx = {
        getState: () => state,
        dispatch: jest.fn(),
        setState: jest.fn()
      } as any;

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

  });

  // beforeEach(() => {

  //   OhMyState.domain = 'test';
  // });

  // describe('new Data', () => {
  //   let ctx;
  //   let arg;

  //   beforeEach(() => {
  //     ctx = {
  //       getState: () => state,
  //       dispatch: jest.fn()
  //     } as any as StateContext<IOhMyMock>;


  //   });

  //   it('should dispatch for upsertData if data is new', () => {
  //     expect(ctx.dispatch).toHaveBeenCalled();
  //     expect(arg instanceof UpsertData).toBe(true);
  //   });

  //   it('should upsert the new Data including its context', () => {
  //     expect(arg.payload).toEqual({
  //       url: 'url',
  //       id: (expect as any).anything(),
  //       method: 'GET',
  //       type: 'XHR',
  //       mocks: (expect as any).anything(),
  //       activeMock: null
  //     });
  //   });

  //   it('should upsert new data with a domain', () => {
  //     expect(arg.domain).toBe('test');
  //   });

  //   it('should upsert the new data included the new mock', () => {
  //     const id = Object.keys(arg.payload.mocks)[0];
  //     const newMock = arg.payload.mocks[id];
  //     const start = Date.now() - 1000;

  //     const mock = {
  //       id,
  //       createdOn: (expect as any).anything(),
  //       delay: 0,
  //       jsCode: MOCK_JS_CODE,
  //       statusCode: 1
  //     }

  //     expect(newMock).toEqual(mock);
  //     expect(new Date(newMock.createdOn).getTime() >= start).toBeTruthy();
  //   })
  // });

  // it('should insert new mock state if data is known', () => {
  //   state.domains.test.data = [{ id: 'id', mocks: {} }] as IData[];
  //   const ctx = {
  //     getState: () => state,
  //     dispatch: jest.fn(),
  //     setState: jest.fn()
  //   } as any as StateContext<IOhMyMock>;

  //   store.upsertMock(ctx, { payload: { mock: { id: 'id', statusCode: 1 } }, domain: 'test' });
  //   expect(ctx.setState).toHaveBeenCalled();
  // });

  // describe('mock update', () => {
  //   // clone
  // });

});
