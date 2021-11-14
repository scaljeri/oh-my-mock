import { objectTypes } from '../constants';
import { MigrateUtils } from './migrate';

beforeEach(() => {
  MigrateUtils.version = '2.0.0';
  MigrateUtils.storeSteps = [jest.fn(x => { x.a += x.a; return x }), jest.fn(x => { x.a += '-'; return x })];
  MigrateUtils.stateSteps = [jest.fn().mockReturnValue('state')];
  MigrateUtils.requestSteps = [jest.fn().mockReturnValue('request')];
  MigrateUtils.mockSteps = [jest.fn().mockReturnValue('response')];
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
      expect(out).toBe('state');
    });

    it('should migrate the request', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: objectTypes.REQUEST } as any);

      expect(MigrateUtils.requestSteps[0]).toHaveBeenCalled();
      expect(out).toBe('request');
    });

    it('should migrate the response', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: objectTypes.MOCK } as any);

      expect(MigrateUtils.mockSteps[0]).toHaveBeenCalled();
      expect(out).toBe('response');
    });

    it('should handle unknown type', () => {
      const out = MigrateUtils.migrate({ a: 'b', version: '1.0.1', type: 'foo' } as any);
      expect(out).toBeUndefined();
    });
  });
})
