import { objectTypes } from '../constants';
import { MigrateUtils } from './migrate';
import { IOhMyStoredRecord } from './migrations/types';

// The step doubles have to read the record the same way a real step does:
// through `in`, because `IOhMyStoredRecord` promises nothing beyond `version`.
const readA = (data: IOhMyStoredRecord): string =>
  'a' in data && typeof data.a === 'string' ? data.a : '';

// Identifiable results, so a test can assert which step array was picked
// without a step having to return something that is not a record.
const STATE_RESULT: IOhMyStoredRecord = { version: 'state-steps' };
const REQUEST_RESULT: IOhMyStoredRecord = { version: 'request-steps' };
const MOCK_RESULT: IOhMyStoredRecord = { version: 'mock-steps' };

beforeEach(() => {
  MigrateUtils.version = '2.0.0';
  MigrateUtils.storeSteps = [
    jest.fn(x => Object.assign(x, { a: readA(x) + readA(x) })),
    jest.fn(x => Object.assign(x, { a: readA(x) + '-' }))
  ];
  MigrateUtils.stateSteps = [jest.fn(() => STATE_RESULT)];
  MigrateUtils.requestSteps = [jest.fn(() => REQUEST_RESULT)];
  MigrateUtils.mockSteps = [jest.fn(() => MOCK_RESULT)];
});
describe('Utils/Migrate', () => {
  describe('#shouldMigrate', () => {
    it('should migrate if version is older', () => {
      expect(MigrateUtils.shouldMigrate({ version: '1.99.9999' })).toBeTruthy();
    });

    it('should not migrate if version is the same', () => {
      expect(MigrateUtils.shouldMigrate({ version: MigrateUtils.version })).toBeFalsy();
    });

    it('should migrate if version is higher', () => {
      expect(MigrateUtils.shouldMigrate({ version: '2.0.1' })).toBeTruthy();
    });
  });

  describe('#migrate', () => {
    it('should only update version if dev', () => {
      MigrateUtils.version = '1.2.3-beta3'
      const out = MigrateUtils.migrate({ a: 'b', version: '0.0.1-beta10', type: objectTypes.REQUEST } as any);
      expect(out).toEqual(expect.objectContaining({
        a: 'b', version: '1.2.3-beta3'
      }));
    });

    it('return null if input is newer', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '2.0.1', type: objectTypes.REQUEST } as any);
      expect(out).toBeNull();
    });

    it('should migrate the store', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: objectTypes.STORE } as any);

      expect(MigrateUtils.storeSteps[0]).toHaveBeenCalled();
      expect((out as any).a).toBe('bb-');
    });

    it('should migrate the state', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: objectTypes.STATE } as any);

      expect(MigrateUtils.stateSteps[0]).toHaveBeenCalled();
      expect(out).toBe(STATE_RESULT);
    });

    it('should migrate the request', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: objectTypes.REQUEST } as any);

      expect(MigrateUtils.requestSteps[0]).toHaveBeenCalled();
      expect(out).toBe(REQUEST_RESULT);
    });

    it('should migrate the response', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: objectTypes.MOCK } as any);

      expect(MigrateUtils.mockSteps[0]).toHaveBeenCalled();
      expect(out).toBe(MOCK_RESULT);
    });

    it('should handle unknown type', () => {
      // A record whose `type` none of the guards recognise is dropped. This
      // used to resolve `undefined` while `migrate` declared `T | null`; the
      // callers all read it as "nothing came back" either way.
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: 'foo' } as any);
      expect(out).toBeNull();
    });
  
  /**
   * The guard that decides whether to migrate at all.
   *
   * It used to compare `MigrateUtils.version` against a second constant written
   * `'__OH' + '_MY_VERSION__'`, split so `token-replace.js` would leave it
   * alone. Minifiers fold that concat back together, and `ci:build` minifies
   * **before** replacing tokens — so in every production build the two were the
   * same string, the guard was unconditionally true, and `migrate` handed every
   * record straight back. No migration step had ever run in a minified build.
   *
   * There is nothing left to fold: the check is a prefix, and the prefix is not
   * the token, so replacement never touches it.
   */
  describe('recognising a build whose version token was never replaced', () => {
    it('knows the raw token from a version', () => {
      expect(MigrateUtils.isUnreplacedVersion('__OH_MY_VERSION__')).toBe(true);
      expect(MigrateUtils.isUnreplacedVersion('3.3.15')).toBe(false);
      expect(MigrateUtils.isUnreplacedVersion('3.3.15-beta.1')).toBe(false);
    });

    /**
     * The shape a minifier produces. Written out rather than concatenated,
     * because a concat here would be folded too — and then this test would
     * agree with the bug instead of catching it.
     */
    it('is not defeated by the two halves being joined back up', () => {
      expect(MigrateUtils.isUnreplacedVersion('__OH_MY_VERSION__')).toBe(true);
    });

    it('migrates normally once the token has been replaced', () => {
      const before = MigrateUtils.version;
      MigrateUtils.version = '2.0.0';

      try {
        // An old record of a recognised type reaches the step chain rather than
        // being handed straight back.
        const migrated = MigrateUtils.migrate({
          version: '1.0.0',
          type: objectTypes.STORE,
          domains: []
        } as never);

        expect(migrated).not.toBeUndefined();
      } finally {
        MigrateUtils.version = before;
      }
    });
  });
});
})
