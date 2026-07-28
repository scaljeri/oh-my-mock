import { objectTypes } from '../constants';
import { IData, IOhMyRequests, IState } from '../type';
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
    let requests: IOhMyRequests;

    beforeEach(() => {
      state = StateUtils.init({ domain: 'xyz' });
      requests = {
        xyz: { id: '123' } as IData,
        qwe: { method: 'GET', requestType: 'XHR', url: 'url' } as IData,
        asd: { method: 'GET', requestType: 'FETCH', url: 'url' } as IData,
        zzxc: { id: 'zzxc', method: 'GET', requestType: 'XHR', url: 'url1' } as IData,
        zzx1: { method: 'POST', requestType: 'FETCH', url: 'url.*' } as IData
      };
      state.requests = Object.keys(requests);
    });
    describe('#getRequest', () => {
      it('should not return anything if id does not exist', () => {
        expect(StateUtils.getRequest(state, requests, 'aaa')).toBeUndefined();
      });

      it('should not return a request the state does not list', () => {
        state.requests = state.requests.filter(id => id !== 'zzxc');

        expect(StateUtils.getRequest(state, requests, 'zzxc')).toBeUndefined();
      });

      it('should return a request if id is found', () => {
        expect(StateUtils.getRequest(state, requests, 'zzxc')).toEqual(requests.zzxc);
      });
    });
    describe('#findRequest', () => {
      it('should find the request by id', () => {
        expect(StateUtils.findRequest(state, requests, { id: 'zzxc' })).toEqual(
          expect.objectContaining({ id: 'zzxc'}));
      });

      it('should not find anything if no match', () => {
        expect(StateUtils.findRequest(state, requests, {
          requestType: 'XHR',
          method: 'GET',
          url: 'url2'
        })).toBeUndefined();
      });

      it('should ignore requests of another domain', () => {
        state.requests = [];

        expect(StateUtils.findRequest(state, requests, { id: 'zzxc' })).toBeUndefined();
      });

      it('should survive a request record that has not loaded yet', () => {
        expect(StateUtils.findRequest(state, { zzxc: requests.zzxc }, { id: 'zzxc' }))
          .toEqual(expect.objectContaining({ id: 'zzxc' }));
      });

      it('should find a request if xhr matches', () => {
        expect(StateUtils.findRequest(state, requests, {
          requestType: 'FETCH'
        })).toEqual(expect.objectContaining({ requestType: 'FETCH' }));
      });

      it('should find a request if xhr/method matches', () => {
        expect(StateUtils.findRequest(state, requests, {
          requestType: 'FETCH', method: 'POST'
        })).toEqual(expect.objectContaining({ method: 'POST', requestType: 'FETCH' }));
      });

      it('should find a request if xhr/method/url matches', () => {
        expect(StateUtils.findRequest(state, requests, {
          requestType: 'FETCH', method: 'POST', url: 'urlxyz----'
        })).toEqual(expect.objectContaining({ method: 'POST', requestType: 'FETCH' }));
      });
    });
    describe('#setRequest', () => {
      it('should add the id to the state', () => {
        const nstate = StateUtils.setRequest(state, 'a');

        expect(state.requests).not.toContain('a');
        expect(nstate.requests).toContain('a');
      });

      it('should not touch the state if the id is already listed', () => {
        expect(StateUtils.setRequest(state, 'zzxc')).toBe(state);
      });
    });
    describe('#removeRequest', () => {
      it('should remove a request', () => {
        const nstate = StateUtils.removeRequest(state, 'zzxc');

        expect(state.requests).toContain('zzxc');
        expect(nstate.requests).not.toContain('zzxc');
      });

      it('should not touch the state if the id is unknown', () => {
        expect(StateUtils.removeRequest(state, 'nope')).toBe(state);
      });
    });
    describe('#pickRequests', () => {
      it('should only return what the state lists', () => {
        state.requests = ['zzxc', 'qwe'];

        expect(Object.keys(StateUtils.pickRequests(state, requests)).sort())
          .toEqual(['qwe', 'zzxc']);
      });

      it('should skip ids without a record', () => {
        state.requests = ['zzxc', 'not-loaded'];

        expect(Object.keys(StateUtils.pickRequests(state, requests))).toEqual(['zzxc']);
      });
    });
  });
});
