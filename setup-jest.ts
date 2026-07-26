import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

// jest-preset-angular 17 replaced the old side-effect import
// (`jest-preset-angular/setup-jest`) with an explicit call. Without it the
// TestBed is never initialised and every component spec fails with
// "Need to call TestBed.initTestEnvironment() first".
setupZoneTestEnv();
