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
      const fn = (StorageUtils.chrome.storage.onChanged.addListener as unknown as jest.Mock).mock.calls[0][0];
      fn({ bar: 'foo', baz: 'moz' });
    });
  });

  describe('#get', () => {
    // Spies on `MigrateUtils` land on the real, shared object — assigning to
    // its methods here without restoring used to leak the fakes into every
    // suite that ran after this one.
    afterEach(() => jest.restoreAllMocks());

    it('returns the stored value for the key', async () => {
      await expect(StorageUtils.get('a')).resolves.toEqual('foo');
    });

    /**
     * Read-time migration is deliberately switched off — the commented block in
     * `storage.ts`. Records are migrated where they are written: at background
     * start-up (`background/init.ts`) and on import. A `get` that migrated
     * would turn every read into a potential write.
     *
     * So the claim to pin is a negative: `get` consults nothing and writes
     * nothing, *even for a record the migrator would flag*. Uncommenting that
     * block makes both of these fail.
     */
    it('does not consult the migrator, even for a record it would flag', async () => {
      const shouldMigrate = jest
        .spyOn(StorageUtils.MigrateUtils, 'shouldMigrate')
        .mockReturnValue(true);
      const migrate = jest
        .spyOn(StorageUtils.MigrateUtils, 'migrate')
        .mockReturnValue('migrated-data' as never);

      await expect(StorageUtils.get('a')).resolves.toEqual('foo');

      expect(shouldMigrate).not.toHaveBeenCalled();
      expect(migrate).not.toHaveBeenCalled();
    });

    it('writes nothing back', async () => {
      const set = jest.spyOn(StorageUtils, 'set');

      await StorageUtils.get('a');

      expect(set).not.toHaveBeenCalled();
      expect(StorageUtils.chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('#setStore', () => {
    it('should set the storage key', () => {
      jest.spyOn(StorageUtils, 'set').mockResolvedValue(undefined);
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

    /**
     * The bug this pins: the arrow had a block body with no `return`, so
     * `Promise.all` resolved over `[undefined, …]` at once. Every `await
     * StorageUtils.remove(...)` returned before the delete had happened —
     * `remove-handler.ts` then re-imported the demo domain over a delete that
     * was still in flight. `tsc` said nothing, because `undefined[]` satisfies
     * the declared `void[]`.
     *
     * Asserting the call happened is not enough; it happened before too. This
     * asserts the promise **waits** for chrome to call back.
     */
    it('does not resolve until chrome says the key is gone', async () => {
      const callbacks: (() => void)[] = [];
      StorageUtils.chrome.storage.local.remove = jest.fn(
        (_key: string, cb: () => void) => callbacks.push(cb)
      ) as never;

      let settled = false;
      const removing = StorageUtils.remove(['foo', 'bar']).then(() => {
        settled = true;
      });

      await Promise.resolve();
      expect(settled).toBe(false);

      // One of the two answers is not all of them.
      callbacks[0]();
      await Promise.resolve();
      expect(settled).toBe(false);

      callbacks[1]();
      await removing;
      expect(settled).toBe(true);
    });

    it('should remove the data for the keys given', async () => {
      await StorageUtils.remove(['foo', 'bar']);

      expect(StorageUtils.chrome.storage.local.remove).toHaveBeenCalledTimes(2);
      expect((StorageUtils.chrome.storage.local.remove as unknown as jest.Mock).mock.calls).toEqual([
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
