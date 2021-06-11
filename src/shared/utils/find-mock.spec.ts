import { testDataMock } from '../test-site.mocks';
import { IState } from '../type';
import { findMocks } from './find-mock';
describe('Utils#findMocks', () => {
  let state: IState;

  beforeEach(() => {
    state = JSON.parse(JSON.stringify(testDataMock));
    state.data[1] = { ...state.data[0] };
    state.data[1].id = 'newid';
    state.data[0].enabled = false;
  });
  it('should find the first match', () => {
    const mocks = findMocks(state, { url: '/users', method: 'PUT', type: 'FETCH'});
    expect(mocks.id).toBe(state.data[0].id);
  });

  it('should find the first active match', () => {
    const mocks = findMocks(state, { url: '/users', method: 'PUT', type: 'FETCH' }, false);
    expect(mocks.id).toBe(state.data[1].id);
  })
});
