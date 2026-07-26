import { defineConfig } from '@playwright/test';

/**
 * E2E configuration for the OhMyMock extension.
 *
 * The suite loads the built extension from `./dist`, so run `yarn build` (or
 * `yarn build:bundles` for the non-Angular parts) before `yarn e2e`.
 *
 * Browser launch lives in `tests/fixtures/extension.ts` rather than here:
 * extensions require `launchPersistentContext`, which Playwright's built-in
 * browser fixture does not use. That also means most `use` browser options are
 * intentionally absent — they would be silently ignored.
 */
export default defineConfig({
  testDir: './tests/specs',
  testMatch: '**/*.spec.ts',

  // Launching a browser per test costs a second or two; the mocking round trips
  // themselves are fast.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Single worker, deliberately.
  //
  // The suite's strongest assertion is "the server was never contacted", which
  // reads a request counter held by the one shared test server. Two workers
  // means two spec files resetting and incrementing that counter at the same
  // time, and the count stops meaning anything. Per-test counter scoping would
  // buy parallelism back, but the whole suite runs in about a minute as is.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),

  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'test-results/html', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'test-results/html', open: 'never' }]],

  outputDir: 'test-results/artifacts',

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  // Started with plain node: Node strips the TypeScript, so no ts-node needed.
  webServer: {
    command: 'node test-site/server/index.mts',
    url: 'http://localhost:8090/_harness/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  },

  projects: [{ name: 'chromium-extension' }]
});
