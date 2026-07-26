const { pathsToModuleNameMapper } = require('ts-jest');
const { createCjsPreset } = require('jest-preset-angular/presets');
const { compilerOptions } = require('./tsconfig');

/**
 * Unit tests only — the browser-level suite lives in `tests/` and runs under
 * Playwright (see `playwright.config.ts`).
 *
 * CommonJS. An ESM setup would be the more modern choice, but jest-preset-angular's
 * ESM preset resolves several dependencies whose `.js` files hold ESM syntax
 * while declaring no `"type": "module"`, and Node then loads them as CommonJS —
 * every suite dies in cjs-module-lexer before a single test runs.
 *
 * The one thing CommonJS cannot compile is `import.meta`, which is why the web
 * worker is constructed behind an injection token (`OH_MY_SEARCH_WORKER_FACTORY`)
 * rather than inline in the service.
 */
const preset = createCjsPreset();

module.exports = {
  ...preset,
  roots: ['<rootDir>/src/'],
  testMatch: ['**/+(*.)+(spec).+(ts)'],
  setupFilesAfterEnv: ['<rootDir>/src/test.ts'],
  collectCoverage: true,
  coverageReporters: ['html'],
  coverageDirectory: 'coverage/app',
  // Extends the preset's pattern rather than replacing it — the preset's
  // `.mjs$` clause is what lets Angular's own fesm2022 bundles through, and
  // dropping it breaks every suite. `@faker-js/faker` and `jsonpath-plus` are
  // added because both ship ESM-only `.js` builds that CommonJS cannot parse
  // unless they go through the transformer too.
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@angular/common/locales/.*\\.js$|@faker-js/.*|jsonpath-plus/.*))'
  ],
  moduleNameMapper: {
    ...preset.moduleNameMapper,
    // The `@shared/*` alias from tsconfig.
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, {
      prefix: '<rootDir>/'
    })
  }
};
