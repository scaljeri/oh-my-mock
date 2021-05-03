import { MigrationsService } from './migrations.service';

const CURRENT_VERSION = '__OH_MY_VERSION__';

describe('MigrationsService', () => {
  let service: MigrationsService;
  let state: any;

  beforeEach(() => {
    state = {
      version: CURRENT_VERSION,
      data: 'data'
    };
    service = new MigrationsService({ version: CURRENT_VERSION } as any)
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Up2Date', () => {
    beforeEach(() => {
    });

    it('should not modify the data if it has current version', () => {
      const out = service.update(state);
      expect(out).toEqual(state);
    });
  });

  describe('Older version', () => {
    it('should reset the data', () => {
      state.version = '2.0.0';
      const out = service.update(state);
      expect(out).toEqual(service.reset());
    });

    it('should migrate the data', () => {
      state.version = '2.1.0';
      const out = service.update(state);
      expect(out).toEqual({ ...state, version: '__OH_MY_VERSION__' });
    })
  });

  describe('Unknown version', () => {
    it('should reset the data', () => {
      state.version = '1.9.0';
      const out = service.update(state);
      expect(out).toEqual(service.reset());
    });
  });

  describe('No version', () => {
    it('should reset the data', () => {
      delete state.version;
      const out = service.update(state);
      expect(out).toEqual(service.reset());
    });
  });


});
