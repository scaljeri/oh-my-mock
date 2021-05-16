import { StateContext } from '@ngxs/store';
import { IOhMyMock, IData } from '@shared/type';
import { UpsertData } from './actions';
import { OhMyState } from './state';

describe('Store#upsertMock', () => {
  let state: IOhMyMock;
  let store: OhMyState;

  beforeEach(() => {
    store = new OhMyState();
    state = { domains: { 'test': { domain: 'test', data: [], views: {}, toggles: {} } }, version: '2.0.0' };
    OhMyState.domain = 'test';
  });

  describe('new Data', () => {
    it('should dispatch for upsertData if data is new', () => {
      const ctx = {
        getState: () => state,
        dispatch: jest.fn()
      } as any as StateContext<IOhMyMock>;
      // jest.spyOn(ctx, 'dispatch');

      store.upsertMock(ctx, { payload: { mock: { id: 'id', statusCode: 1 } }, domain: 'test' });

      expect(ctx.dispatch).toHaveBeenCalled();
      const arg = (ctx.dispatch as any).mock.calls[0][0];

      expect(arg instanceof UpsertData).toBe(true);
    });

    it('should insert new mock state if data is known', () => {
      state.domains.test.data = [{ id: 'id', mocks: {} }] as IData[];
      const ctx = {
        getState: () => state,
        dispatch: jest.fn(),
        setState: jest.fn()
      } as any as StateContext<IOhMyMock>;

      store.upsertMock(ctx, { payload: { mock: { id: 'id', statusCode: 1 } }, domain: 'test' });
      expect(ctx.setState).toHaveBeenCalled();
    })
  });
});
