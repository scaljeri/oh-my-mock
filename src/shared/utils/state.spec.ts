import { objectTypes } from '../constants';
import { IState } from '../type';
import { StateUtils } from './state';

describe('Utils/State', () => {
  let state: IState;
  describe('#init', () => {
    beforeEach(() => {
      state = StateUtils.init({ domain: 'a.b.c', version: 'x.y.z', type: 'foo' } as any as IState)
    });
    it('should have a valid context', () => {
      expect(state.context).toHaveProperty('domain', 'a.b.c')
    });

    it('should have the provided version', () => {
      expect(state.version).toBe('x.y.z')
    });

    it('should have ignored the provided type', () => {
      expect(state.type).toBe(objectTypes.STATE)
    });
  });
  describe('#isState', () => {
    it('should determine that obeject is not a state', () => {
      expect(StateUtils.isState({ a: 10 })).toBeFalsy();
      expect(StateUtils.isState({ type: objectTypes.STORE })).toBeFalsy();
    });

    it('should determine that obeject is a state', () => {
      expect(StateUtils.isState({ type: objectTypes.STATE })).toBeTruthy();
    });
  });

  describe('state action', () => {
    beforeEach(() => {
      state = StateUtils.init({ domain: 'xyz' });
      state.data['xyz'] = { id: '123' } as any;
      state.data['qwe'] = { method: 'GET', requestType: 'XHR', url: 'url' } as any;
      state.data['asd'] = { method: 'GET', requestType: 'FETCH', url: 'url' } as any;
      state.data['zzxc'] = { id: 'zzxc', method: 'GET', requestType: 'XHR', url: 'url1' } as any;
      state.data['zzx1'] = { method: 'POST', requestType: 'FETCH', url: 'url.*' } as any;
    });
    describe('#getRequest', () => {
      it('should not return anything if id does not exist', () => {
        expect(StateUtils.getRequest(state, 'aaa')).toBeUndefined();
      });

      it('should return a request if id is found', () => {
        expect(StateUtils.getRequest(state, 'zzxc')).toEqual(state.data.zzxc);
      });
    });
    describe('#findRequest', () => {
      it('should find the request by id', () => {
        expect(StateUtils.findRequest(state, { id: 'zzxc' })).toEqual(
          expect.objectContaining({ id: 'zzxc'}));
      });

      it('should not find anything if no match', () => {
        expect(StateUtils.findRequest(state, {
          requestType: 'XHR',
          method: 'GET',
          url: 'url2'
        })).toBeUndefined();
      });

      it('should find a request if xhr matches', () => {
        expect(StateUtils.findRequest(state, {
          requestType: 'FETCH'
        })).toEqual(expect.objectContaining({ requestType: 'FETCH' }));
      });

      it('should find a request if xhr/method matches', () => {
        expect(StateUtils.findRequest(state, {
          requestType: 'FETCH', method: 'POST'
        })).toEqual(expect.objectContaining({ method: 'POST', requestType: 'FETCH' }));
      });

      it('should find a request if xhr/method/url matches', () => {
        expect(StateUtils.findRequest(state, {
          requestType: 'FETCH', method: 'POST', url: 'urlxyz----'
        })).toEqual(expect.objectContaining({ method: 'POST', requestType: 'FETCH' }));
      });
    });
    describe('#setRequest', () => {
      it('should set a request', () => {
        const nstate = StateUtils.setRequest(state, { id: 'a' } as any);
        expect(state.data.a).not.toBeDefined();
        expect(nstate.data.a).toBeDefined();
      })
    });
    describe('#removeRequest', () => {
      it('should remove a request', () => {
        const data = StateUtils.removeRequest(state, 'zzxc');

        expect(state.data.zzxc).not.toBeDefined();
        expect(data.id).toBe('zzxc');
      });
    });
  });
});
