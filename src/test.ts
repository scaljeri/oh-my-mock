import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

// jest-preset-angular 17 replaced the old side-effect import
// (`jest-preset-angular/setup-jest`) with an explicit call. Without it the
// TestBed is never initialised and every component spec fails with
// "Need to call TestBed.initTestEnvironment() first".
setupZoneTestEnv();

Object.defineProperty(window, 'CSS', { value: null });
Object.defineProperty(window, 'chrome', {
  value: {
    debugger: { onEvent: { addListener: () => { } } },
    runtime: {
      onMessage: { addListener: () => { } },
      getManifest: () => ({ version: '9.9.9' })
    },
    storage: {
      onChanged: {
        addListener: () => {}
      },
      // Present in every browser this extension supports (Chrome 102+, and
      // `minimum_chrome_version` is 109). Stubbed here because code that keeps
      // state across a service-worker teardown uses it, and a stub without it
      // makes that code look broken in tests while being right in production.
      session: {
        get: async () => ({}),
        set: async () => undefined
      }
    }
  },
});
Object.defineProperty(window, 'getComputedStyle', {
  value: () => {
    return {
      display: 'none',
      appearance: ['-webkit-appearance'],
    };
  },
});

Object.defineProperty(document, 'doctype', {
  value: '<!DOCTYPE html>',
});

Object.defineProperty(document.body.style, 'transform', {
  value: () => {
    return {
      enumerable: true,
      configurable: true,
    };
  },
});
