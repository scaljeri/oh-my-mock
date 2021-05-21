import { OhMyState } from './state';
import { STORAGE_KEY, DEMO_TEST_DOMAIN, MOCK_JS_CODE } from '@shared/constants'
import { testDataMock } from '@shared/test-site.mocks';

describe('State', () => {
  let ctx;
  let store;
  let data;

  beforeEach(() => {
    store = new OhMyState();
    OhMyState.domain = 'localhost';
    ctx = {
      setState: jest.fn(),
      getState: () => ({
        domains: {
          localhost: 'x',
          'a': { b: 'c' }
        }
      } as any)
    };
  });

  describe('#getActiveState', () => {
    it('should should handle complete state with default domain', () => {
      expect(OhMyState.getActiveState({
        [STORAGE_KEY]: {
          domains: {
            'a': 'b',
            localhost: 'c'
          }
        }
      } as any)).toBe('c');
    });

    it('should should handle complete state with domain', () => {
      expect(OhMyState.getActiveState({
        [STORAGE_KEY]: {
          domains: {
            'a': 'b',
            localhost: 'c'
          }
        }
      } as any, 'a')).toBe('b');
    });

    it('should handle just the domain state', () => {
      expect(OhMyState.getActiveState({
        domains: {
          'a': 'b',
          localhost: 'c'
        }
      } as any, 'a')).toBe('b');
    });
  });

  describe('#getMyState', () => {
    let domain;
    let state;

    beforeEach(() => {
      [state, domain] = OhMyState.getMyState(ctx, 'a');
    })
    it('should extract and clone state', () => {
      expect(state).toEqual({ b: 'c' });
    });

    it('should determine the right domain', () => {
      expect(domain).toEqual('a');
    });
  });

  describe('#reset', () => {
    it('should reset for a domain', () => {
      store.reset(ctx, { payload: 'a' });

      expect(ctx.setState).toHaveBeenCalledWith({
        domains: {
          a: {
            data: [],
            domain: 'a',
            toggles: {},
            views: {
              hits: [],
              normal: [],
            },
          },
          localhost: 'x',
        }
      });
    });

    it('should do a global reset', () => {
      store.reset(ctx, {});

      expect(ctx.setState).toHaveBeenCalledWith({
        domains: {
          [DEMO_TEST_DOMAIN]: (expect as any).anything(),
          localhost: (expect as any).anything()
        },
        version: undefined
      });
    })
  });

  describe('#deleteMock', () => {
    let state;
    beforeEach(() => {
      state = JSON.parse(JSON.stringify(testDataMock));
      state.data[1].mocks.xyz = { id: '1WHlVDBpDr', response: 'test' };
      state.data[1].activeMock = 'XDuYG9Izod';
      ctx.getState = () => ({ version: '2.0.0', domains: { 'localhost': state } })

      store.deleteMock(ctx, { payload: { id: '1WHlVDBpDr', mockId: 'xyz' } })
      data = ctx.setState.mock.calls[0][0].domains.localhost.data[1];
    });

    it('should remove the mock from the mocks list', () => {
      expect(data.mocks.xyz).not.toBeDefined();
    });

    it('should keep other mocks', () => {
      expect(data.mocks.XDuYG9Izod).toBeDefined();
    });

    it('should keep the active mock reference', () => {
      expect(data.activeMock).toBe('XDuYG9Izod');
    });

    it('should do nothing if mock does not exist', () => {
      store.deleteMock(ctx, { payload: { id: '1WHlVDBpDr', mockId: 'foo' } })
      data = ctx.setState.mock.calls[0][0].domains.localhost.data[1];

      expect(Object.keys(data.mocks).length).toBe(1);
    });

    it('should clear activeMock if mock is removed', () => {
      store.deleteMock(ctx, { payload: { id: '1WHlVDBpDr', mockId: 'XDuYG9Izod' } })
      data = ctx.setState.mock.calls[1][0].domains.localhost.data[1];

      expect(Object.keys(data.mocks).length).toBe(1); // mock with id 'xyz' exists everytime getState is called
      expect(data.mocks['1WHlVDBpDr']).not.toBeDefined();
      expect(data.activeMock).toBeNull();
    });
  });

  describe('#deleteData', () => {
    beforeEach(() => {
      ctx.getState = () => ({ version: '2.0.0', domains: { 'localhost': testDataMock } })

      store.deleteData(ctx, { payload: '1WHlVDBpDr' })
      data = ctx.setState.mock.calls[0][0].domains.localhost.data
    });

    it('remove the data entry from the data array', () => {
      expect(data.length + 1).toBe(testDataMock.data.length);
    });

    it('should remove the data item by id', () => {
      expect(data.find(d => d.id === '1WHlVDBpDr')).not.toBeDefined();
    });
  });

  describe('#viewChangeOrderItems', () => {
    let views;

    beforeEach(() => {
      ctx.getState = () => ({
        version: '2.0.0', domains: {
          'localhost': {
            data: [0, 1, 2, 3, 4, 5],
            views: {
              bar: [0, 1, 2, 3, 4, 5]
            }
          }
        }
      }) as any;
    });

    describe('Update existing', () => {
      beforeEach(() => {
        store.viewChangeOrderOfItems(ctx, { payload: { name: 'bar', from: 5, to: 0 } })
        views = ctx.setState.mock.calls[0][0].domains.localhost.views;
      });

      it('should update the view', () => {
        expect(views.bar).toEqual([5, 0, 1, 2, 3, 4]);
      });

      it('should not create new views', () => {
        expect(Object.keys(views).length).toBe(1);
      });
    });

    describe('new view', () => {
      beforeEach(() => {
        store.viewChangeOrderOfItems(ctx, { payload: { name: 'foo', from: 3, to: 1 } })
        views = ctx.setState.mock.calls[0][0].domains.localhost.views;
      });

      it('should initialize a new view', () => {
        expect(views.foo).toBeDefined();
      });

      it('should apply the swap', () => {
        expect(views.foo).toEqual([0, 3, 1, 2, 4, 5]);
      });
    });
  });

  describe('#toggle', () => {
    let toggles;

    beforeEach(() => {
      ctx.getState = () => ({
        domains: {
          localhost: {
            toggles: { bar: false }
          }
        }
      }) as any;
    })
    describe('update existing', () => {
      beforeEach(() => {
        store.toggle(ctx, { payload: { name: 'bar', value: true } })
        toggles = ctx.setState.mock.calls[0][0].domains.localhost.toggles;
      });

      it('should update existing toggle', () => {
        expect(toggles.bar).toBeTruthy();
      });

      it('should not create new toggles', () => {
        expect(Object.keys(toggles).length).toBe(1);
      });
    });

    describe('new toggle', () => {
      beforeEach(() => {
        store.toggle(ctx, { payload: { name: 'foo', value: false } })
        toggles = ctx.setState.mock.calls[0][0].domains.localhost.toggles;
      });

      it('should add new toggle', () => {
        expect(toggles.foo).toBe(false);
      });

      it('should keep other existing toggle', () => {
        expect(toggles.bar).toBeDefined();
      });
    })
  });

  describe('#viewReset', () => {
    let views;

    beforeEach(() => {
      ctx.getState = () => ({
        domains: {
          localhost: {
            data: [1, 2, 3],
            views: { a: [2, 1, 0] }
          }
        }
      });

      store.viewReset(ctx, { payload: 'a' });
      views = ctx.setState.mock.calls[0][0].domains.localhost.views;
    });

    it('should reset sorting of the view', () => {
      expect(views.a).toEqual([0, 1, 2]);
    });

    it('should not create new views', () => {
      expect(Object.keys(views).length).toBe(1);
    });
  });

  describe('#findData', () => {
    it('should find it by ID', () => {
      const out = OhMyState.findData(testDataMock, {
        id: 'JInS4zhNeG'
      });

      expect(out.index).toBe(3);
      expect(out.data.id).toBe('JInS4zhNeG');
    });

    it('should find without id', () => {
      const out = OhMyState.findData(testDataMock, {
        url: 'a', method: 'b', type: 'c'
      } as any);

      expect(out.index).toBe(-1);
      expect(out.data).toEqual({
        id: (expect as any).anything(), url: 'a', method: 'b', type: 'c', mocks: {}, activeMock: null
      });
    })
  });

  describe('#cloneMock', () => {
    it('should deep clone', () => {
      const mock = {
        a: 'b',
        headers: { c: 'd' },
        headersMock: { e: 'f' }
      } as any;
      const clone = OhMyState.cloneMock(mock);

      expect(clone).toEqual(mock);
      clone.headers.x = 'y';
      expect(clone).not.toEqual(mock);
    });

    it('should return a new mock if input mock does not exist', () => {
      const clone = OhMyState.cloneMock(null);

      expect(clone).toEqual({ jsCode: MOCK_JS_CODE, delay: 0 });
    });
  });
});
