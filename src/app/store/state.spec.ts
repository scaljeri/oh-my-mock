import { OhMyState } from './state';
import { STORAGE_KEY, DEMO_TEST_DOMAIN } from '@shared/constants'

describe('State', () => {
  let ctx;
  let store;
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
});
