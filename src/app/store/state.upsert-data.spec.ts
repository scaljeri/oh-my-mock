import { StateContext } from '@ngxs/store';
import { IOhMyMock, IData, IMock, ohMyMockId, IState } from '@shared/type';
import { OhMyState } from './state';

import { testDataMock } from '@shared/test-site.mocks';

describe('Store#upsertData', () => {
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
      domains: { 'localhost': { domain: 'test', data: [], views: { test: [1, 0, 2, 3] }, toggles: {} } }, version: '2.0.0'
    }

    ctx = {
      getState: () => state,
      dispatch: jest.fn(),
      setState: jest.fn()
    } as any
  });

  describe('new', () => {
    beforeEach(() => {
      store.upsertData(ctx, {
        payload: { url: 'a', method: 'PUT', type: 'FETCH', mocks: { x: 10 } }, domain: 'localhost'
      } as any);

      update = (ctx.setState as any).mock.calls[0][0].domains.localhost;
      data = update.data[0];
    });

    it('should create', () => {
      expect(data.id).toBeDefined();
    });

    it('should have a type', () => {
      expect(data.type).toBe('FETCH');
    });

    it('should have a method', () => {
      expect(data.method).toBe('PUT');
    });

    it('should have an url', () => {
      expect(data.url).toBe('a');
    });

    it('should update the views', () => {
      expect(update.views.test).toEqual([0, 2, 1, 3, 4]);
    });

    describe('update', () => {
      beforeEach(() => {
        ctx.getState = () => ({ version: '2.0.0', domains: { 'localhost': testDataMock } })
      })
      it('should set the modifiedOn property', () => {
      });
    });
  });
});
