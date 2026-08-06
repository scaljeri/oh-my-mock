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

/**
 * The port this run's test site listens on — its own, not a shared one.
 *
 * The suite's strongest assertion is "the server was never contacted", and it
 * reads a request counter that lives in the test site process. That counter is
 * global to that process, so two runs on one machine — two checkouts, two
 * agents, a rerun started before the last one finished — reset and increment
 * the *same* counter and neither run's counts mean anything any more. It used
 * to be worse than a wrong number: `reuseExistingServer` meant the second run
 * silently adopted the first run's server rather than failing.
 *
 * That is not hypothetical, and it is not subtle either once the server records
 * who reset it and when: during one full run here, 85 resets came from another
 * run and 23 of them landed in the middle of one of this run's tests. It cost
 * that run ten failures — hit counts of 18 and 7 where the test asserted 0, and
 * 0 where it asserted 1 — none of which had anything to do with the extension.
 * A wrong count is also exactly the shape of the failure that led here,
 * `onload.spec.ts` seeing two hits for a request its page made once, which is
 * reason enough to make it impossible whether or not it was the cause that day.
 *
 * Derived from the process id, so it is fixed for the whole run and no two runs
 * alive at the same time can pick the same one. `SITE_PORT` overrides it when a
 * fixed port is wanted — a site left running by `npm run test-site`, say — and
 * only then is an existing server reused.
 */
const FIXED_PORT = process.env.SITE_PORT;
// Even offsets only: the alternate origin takes `port + 1`, so odd ones would
// let one run's alternate origin land on another run's main site.
const SITE_PORT = Number(FIXED_PORT ?? 8090 + (process.pid % 400) * 2);

// Read by `tests/fixtures/extension.ts` in the worker processes, which are
// spawned after this file has been evaluated and inherit what it sets here.
// Assigned only if unset, which is what makes it safe that a worker evaluates
// this file again: its own pid would pick a different port, and the inherited
// value — the one the site is actually listening on — has to win.
process.env.SITE_ORIGIN ??= `http://localhost:${SITE_PORT}`;
process.env.ALT_ORIGIN ??= `http://localhost:${SITE_PORT + 1}`;

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
  //
  // Reusing a server that happens to be listening is only safe when the port was
  // asked for by name: on the per-run port an existing server is somebody else's
  // run, and adopting it is the thing that made the counts meaningless. Without
  // the reuse, Playwright says so and stops instead.
  webServer: {
    command: `node test-site/server/index.mts --port ${SITE_PORT}`,
    url: `http://localhost:${SITE_PORT}/_harness/health`,
    reuseExistingServer: Boolean(FIXED_PORT) && !process.env.CI,
    timeout: 30_000
  },

  projects: [{ name: 'chromium-extension' }]
});
