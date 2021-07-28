import { MigrationsService } from './migrations.service';

const CURRENT_VERSION = '200.6.0';

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
