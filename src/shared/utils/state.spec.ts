import { objectTypes } from '../constants';
import { IData, IOhMyRequests, IState } from '../type';
import { StateUtils } from './state';
import { IOhMyGroup } from '../type';
import { GroupUtils } from './group';

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

      // Carries a url, as every real lookup does: the injected script always
      // sends one. Without it the search is satisfied by `xyz`, the fixture
      // that has no url, method or type at all — see the wildcard test below.
      it('should find a request if xhr matches', () => {
        expect(StateUtils.findRequest(state, requests, {
          requestType: 'FETCH', url: 'url'
        })).toEqual(expect.objectContaining({ requestType: 'FETCH' }));
      });

      /**
       * A stored request with no `requestType` matches either transport.
       *
       * The guard used to sit on the incoming side alone, and the injected
       * script always sends a type — so a record stored without one could never
       * match anything, silently. `DataUtils.create` does not default the field,
       * so an imported backup lands exactly here.
       */
      it('should match a stored request that has no requestType', () => {
        requests.typeless = { method: 'GET', url: 'url-typeless' } as IData;
        state.requests = [...state.requests, 'typeless'];

        expect(StateUtils.findRequest(state, requests, {
          requestType: 'FETCH', method: 'GET', url: 'url-typeless'
        })).toEqual(expect.objectContaining({ url: 'url-typeless' }));

        expect(StateUtils.findRequest(state, requests, {
          requestType: 'XHR', method: 'GET', url: 'url-typeless'
        })).toEqual(expect.objectContaining({ url: 'url-typeless' }));
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

/**
 * Which group a request comes from decides whether it answers at all, and which
 * of two answers wins. Without this, switching a group off in the sidebar
 * changed the picture on screen and nothing else — the mock kept being served,
 * silently, which is this project's signature failure.
 */
describe('StateUtils.findRequest with mock groups', () => {
  const DOMAIN = 'example.com';

  const group = (id: string, source: 'local' | 'cloud' = 'cloud'): IOhMyGroup =>
    GroupUtils.init({ id, source, domains: [DOMAIN] });

  const local = GroupUtils.defaultLocalFor(DOMAIN);

  const request = (id: string, over: Partial<IData> = {}): IData =>
    ({ id, url: '/api/users', method: 'GET', ...over }) as IData;

  const stateWith = (ids: string[]): IState =>
    StateUtils.init({ domain: DOMAIN, requests: ids });

  it('serves a request whose group is active', () => {
    const requests = { r1: request('r1') };

    expect(
      StateUtils.findRequest(stateWith(['r1']), requests, { url: '/api/users' }, [local])?.id
    ).toBe('r1');
  });

  it('does not serve a request whose group is switched off', () => {
    const requests = { r1: request('r1') };

    // The local group is absent from `active` — that is what switched off means.
    expect(
      StateUtils.findRequest(stateWith(['r1']), requests, { url: '/api/users' }, [])
    ).toBeUndefined();
  });

  it('serves nothing from a group that is gone, even though the request remains', () => {
    const requests = { r1: request('r1', { groupId: 'deleted' }) };

    expect(
      StateUtils.findRequest(stateWith(['r1']), requests, { url: '/api/users' }, [local])
    ).toBeUndefined();
  });

  /** The visible, draggable rule: the higher group answers. Not a fallback. */
  it('lets the higher group answer when both know the endpoint', () => {
    const theirs = group('theirs');
    const requests = {
      mine: request('mine'),
      theirs: request('theirs', { groupId: 'theirs' })
    };
    const state = stateWith(['mine', 'theirs']);

    expect(
      StateUtils.findRequest(state, requests, { url: '/api/users' }, [local, theirs])?.id
    ).toBe('mine');
    // Same requests, same state — only the order of the groups differs.
    expect(
      StateUtils.findRequest(state, requests, { url: '/api/users' }, [theirs, local])?.id
    ).toBe('theirs');
  });

  it('falls to the next group when the higher one is switched off', () => {
    const theirs = group('theirs');
    const requests = {
      mine: request('mine'),
      theirs: request('theirs', { groupId: 'theirs' })
    };

    expect(
      StateUtils.findRequest(stateWith(['mine', 'theirs']), requests, { url: '/api/users' }, [theirs])?.id
    ).toBe('theirs');
  });

  /**
   * Everything away from the serving path — the export dialog, the popup's own
   * lookups — asks what *exists*, not what would answer.
   */
  it('considers every stored request when no groups are given', () => {
    const requests = { r1: request('r1', { groupId: 'anything' }) };

    expect(
      StateUtils.findRequest(stateWith(['r1']), requests, { url: '/api/users' })?.id
    ).toBe('r1');
  });
});
