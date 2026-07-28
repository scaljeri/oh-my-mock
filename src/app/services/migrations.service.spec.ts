import { TestBed } from '@angular/core/testing';
import { IOhMyMock } from '@shared/type';
import { objectTypes } from '@shared/constants';
import { AppStateService } from './app-state.service';
import { MigrationsService } from './migrations.service';

const CURRENT_VERSION = '200.6.0';

/**
 * Built through TestBed rather than `new MigrationsService(…)`: the dependency
 * comes from `inject()` now, which needs an injection context. The old spec
 * passed a stub as a constructor argument and asserted only that the object
 * existed.
 */
describe('MigrationsService', () => {
  let service: MigrationsService;

  function store(version: string): IOhMyMock {
    return {
      version,
      type: objectTypes.STORE,
      domains: [],
      popupActive: false
    } as unknown as IOhMyMock;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AppStateService, useValue: { version: CURRENT_VERSION } }
      ]
    });

    service = TestBed.inject(MigrationsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('stamps a store of the current version and leaves it alone', () => {
    const result = service.update(store(CURRENT_VERSION));

    expect(result?.version).toBe(CURRENT_VERSION);
  });

  // Only reachable through a hand-edited JSON import: a store claiming to come
  // from a newer build than the extension itself cannot be migrated down.
  it('refuses a store newer than the extension', () => {
    expect(service.update(store('999.0.0'))).toBeNull();
  });

  it('answers null for no store at all', () => {
    expect(service.update(undefined as unknown as IOhMyMock)).toBeNull();
  });
});
