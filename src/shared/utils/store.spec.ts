import { objectTypes } from '../constants';
import { IOhMyMock, IState } from '../type';
import { StoreUtils } from './store';


describe('StoreUtils', () => {
  beforeEach(() => {
    StoreUtils.version = '1.2.3';
  });

  describe('#clone', () => {
    let store;
    let clone;

    beforeEach(() => {
      store = { domains: ['a', 'b'], version: '123'};
      clone = StoreUtils.clone(store as any as IOhMyMock);
    });
    it('should create new object', () => {
      expect(store).not.toBe(clone);
    });

    it('should clone the domain array', () => {
      expect(store.domains).not.toBe(clone.domain);
    });
  });

  describe('#init', () => {
    it('should build a store given a context', () => {
      const store = StoreUtils.init({domain: 'foo'});

      expect(store.domains).toEqual(['foo']);
      expect(store.type).toBe(objectTypes.STORE);
      expect(store.version).toBe('1.2.3');
    });
  });
  describe('#setState', () => {
    it('should add a new state/domain', () => {
      const store = StoreUtils.setState({domains: ['a', 'b']} as any as IOhMyMock, { domain: 'c'} as any as IState );
      expect(store.domains).toEqual(['c', 'a', 'b'])
    });

    it('should not add an existing state/domain', () => {
      const store = StoreUtils.setState({domains: ['a', 'b']} as any as IOhMyMock, { domain: 'b'} as any as IState );
      expect(store.domains).toEqual(['a', 'b'])
    });
  });
  describe('#removeState', () => {
    it('should remove the specified domain', () => {
      const store = StoreUtils.removeState({domains: ['a', 'b', 'c']} as any as IOhMyMock, 'b');

      expect(store.domains).toEqual(['a', 'c']);
    })
  });
});
