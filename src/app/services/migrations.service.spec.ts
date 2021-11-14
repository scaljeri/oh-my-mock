import { MigrationsService } from './migrations.service';

const CURRENT_VERSION = '200.6.0';

describe('MigrationsService', () => {
  let service: MigrationsService;
  let state: any;

  beforeEach(() => {
    state = {
      version: CURRENT_VERSION,
      domains: {}
    };
    service = new MigrationsService({ version: CURRENT_VERSION } as any)
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
