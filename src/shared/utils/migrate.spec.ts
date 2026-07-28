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
  });
})
