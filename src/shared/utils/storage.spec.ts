import { STORAGE_KEY } from '../constants';
import { StorageUtils } from './storage';

describe('Utils/Storage', () => {
  const setFn = StorageUtils.set;
  const removeFn = StorageUtils.remove;

  beforeEach(() => {
    StorageUtils.remove = removeFn;
    StorageUtils.set = setFn;
    StorageUtils.appVersion = '1.2.3';
    StorageUtils.chrome = {
      storage: {
        onChanged: { addListener: jest.fn() },
        local: {
          get: jest.fn((k, cb) => cb({ [k]: 'foo' })),
          set: jest.fn((obj, cb) => cb()),
          clear: jest.fn(cb => cb()),
          remove: jest.fn((key, cb) => cb())
        }
      }
    } as any;
  });

  describe('#listen', () => {
    it('should propagate storage changes', (done) => {
      StorageUtils.updates$.subscribe(val => {
        expect(val).toEqual({ key: 'bar', update: 'foo' });
        done();
      });
      StorageUtils.listen();
      const fn = StorageUtils.chrome.storage.onChanged.addListener['mock'].calls[0][0];
      fn({ bar: 'foo', baz: 'moz' });
    });
  });

  describe('#get', () => {
    it('should skip data migration', (done) => {
      StorageUtils.MigrateUtils.shouldMigrate = jest.fn().mockReturnValue(true);

      StorageUtils.get('a').then(value => {
        expect(value).toEqual('foo');
        done();
      });
    });

    it('should return not migrated data', (done) => {
      StorageUtils.MigrateUtils.shouldMigrate = jest.fn().mockReturnValue(false);
      jest.spyOn(StorageUtils.MigrateUtils, 'migrate').mockReturnValue('migrated-data' as any);
      jest.spyOn(StorageUtils, 'set').mockResolvedValue();

      StorageUtils.get('a').then(value => {
        expect(value).toEqual('foo');
        done();
      });
    });
  });

  describe('#setStore', () => {
    it('should set the storage key', () => {
      jest.spyOn(StorageUtils, 'set').mockReturnValue(null);
      StorageUtils.setStore('store' as any);

      expect(StorageUtils.set).toHaveBeenCalledWith(STORAGE_KEY, 'store');
    });
  });

  describe('#set', () => {
    it('should set the version if not present', async () => {
      await StorageUtils.set('a', { b: 10 } as any);

      expect(StorageUtils.chrome.storage.local.set).toHaveBeenLastCalledWith({ a: { b: 10, version: '1.2.3' } }, expect.anything());
    });

    it('should set the given input', async () => {
      await StorageUtils.set('a', { b: 11, version: 'x' } as any);

      expect(StorageUtils.chrome.storage.local.set).toHaveBeenLastCalledWith({ a: { b: 11, version: 'x' } }, expect.anything());
    });
  });
  describe('#remove', () => {
    it('should remove the the data for the key given', async () => {
      await StorageUtils.remove('foo');

      expect(StorageUtils.chrome.storage.local.remove).toHaveBeenCalledTimes(1);
      expect(StorageUtils.chrome.storage.local.remove).toHaveBeenCalledWith('foo', expect.anything());
    });

    it('should remove the data for the keys given', async () => {
      await StorageUtils.remove(['foo', 'bar']);

      expect(StorageUtils.chrome.storage.local.remove).toHaveBeenCalledTimes(2);
      expect(StorageUtils.chrome.storage.local.remove['mock'].calls).toEqual([
        ['foo', expect.anything()], ['bar', expect.anything()]
      ]);
    });
  });
  describe('#reset', () => {
    it('should clear everything if no args are given', async () => {
      await StorageUtils.reset();

      expect(StorageUtils.chrome.storage.local.clear).toHaveBeenCalledTimes(1);
    });

    it('should clear only the data for a specific key', async () => {
      StorageUtils.remove = jest.fn();
      await StorageUtils.reset('foo');

      expect(StorageUtils.remove).toHaveBeenCalledWith('foo');
    });
   });
});
