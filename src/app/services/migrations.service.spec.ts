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

  describe('Development mode', () => {
    it('should ignore if version is older', () => {
      state.version = '2.0.0';
      const out = service.update(state);
      expect(out).toEqual(state);
    });

    it('should ignore if version is newer', () => {
      state.version = '200.0.0';
      const out = service.update(state);
      expect(out).toEqual(state);
    });

    it('should ignore if data has no version', () => {
      delete state.version;
      const out = service.update(state);
      expect(out).toEqual(state);
    });
  })

  describe('With Version', () => {
    beforeEach(() => {
      service = new MigrationsService({ version: '200.6.0' } as any)
    });
    it('should migrate older version', () => {
      state.version = '2.0.0';
      const out = service.update(state);
      expect(out).toEqual(out);
    });

    it('should ignore if version is bigger than migration', () => {
      state.version = '199.1.0';
      const out = service.update(state);
      expect(out).toEqual({ ...state, version: '200.6.0' });
    });

    it('should ignore if version equals current version', () => {
      state.version = '200.6.0';
      const out = service.update(state);
      expect(out).toEqual(state);
    });

    it('should rese if version is bigger than current', () => {
      state.version = '300.1.0';
      const out = service.update(state);
      expect(out).toEqual(service.reset());
    });

    it('should reset the data', () => {
      delete state.version;
      const out = service.update(state);
      expect(out).toEqual(service.reset());
    })
  });
});
