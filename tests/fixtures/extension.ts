/**
 * Playwright fixtures for driving the OhMyMock extension.
 *
 * Loading an extension requires a persistent context, and MV3 extensions need a
 * browser with an extension host — plain `headless: true` has neither. Chrome's
 * newer headless mode does, so the default here is `headless: false` plus the
 * `--headless=new` flag: no display needed, extension fully functional.
 * Set `HEADED=1` to watch it happen in a real window instead.
 *
 * Each test gets its own browser profile. `chrome.storage` is global to an
 * extension install, so sharing a profile between tests would leak seeded mocks
 * from one test into the next.
 */

import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { OhMyMockDriver } from './oh-my-mock';

/**
 * The build under test. `dist/` unless `EXTENSION_PATH` says otherwise.
 *
 * The override exists because `npm run build` starts by deleting `dist`: a
 * build kicked off while the suite is running takes the extension out from
 * under it, and every test then fails with "no extension build found". Pointing
 * the suite at a copy makes a run immune to that.
 */
export const EXTENSION_PATH = process.env.EXTENSION_PATH
  ? path.resolve(process.env.EXTENSION_PATH)
  : path.resolve(__dirname, '..', '..', 'dist');

/**
 * Fails fast when `dist/` is missing or half-built.
 *
 * Chromium silently refuses to load an extension whose manifest points at files
 * that do not exist — a missing icon is enough. Without this check the only
 * symptom is a 30s "waiting for serviceworker" timeout on every single test,
 * which says nothing about the actual cause.
 */
function assertExtensionBuilt(): void {
  const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `No extension build found at ${EXTENSION_PATH}.\n` +
        'Run `npm run build:bundles` (fast, no Angular) or `npm run build` first.'
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const declared: string[] = [
    ...Object.values(manifest.icons ?? {}),
    manifest.action?.default_icon,
    manifest.background?.service_worker,
    ...(manifest.content_scripts ?? []).flatMap((cs: { js?: string[] }) => cs.js ?? [])
  ].filter(Boolean) as string[];

  const missing = declared.filter(
    (file) => !fs.existsSync(path.join(EXTENSION_PATH, file))
  );

  if (missing.length > 0) {
    throw new Error(
      'The extension build is incomplete — Chromium will refuse to load it.\n' +
        `Missing: ${missing.join(', ')}\n` +
        'Run `npm run build:bundles` (fast, no Angular) or `npm run build`.'
    );
  }
}

/** Where the test site listens. Keep in sync with `playwright.config.ts`. */
export const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'http://localhost:8090';
export const ALT_ORIGIN = process.env.ALT_ORIGIN ?? 'http://localhost:8091';

/** `window.location.host` for the site — the key OhMyMock stores state under. */
export const SITE_DOMAIN = new URL(SITE_ORIGIN).host;
export const ALT_DOMAIN = new URL(ALT_ORIGIN).host;

/**
 * A parsed JSON body, as the harness hands it back.
 *
 * Every property is another `JsonBody`. In the small that is a fiction — a leaf
 * is a string or a number — but a deliberate one: a spec reads
 * `result.json.users[0].name` without a cast, and the `expect()` around it does
 * the real checking. Unlike `any` it is closed, so nothing unrelated can be
 * assigned to it and no other type quietly becomes `any` by touching it.
 *
 * At runtime it is `null` when the response had no JSON body; the specs that
 * read it are the ones that asked for `responseType: 'json'`.
 */
export interface JsonBody {
  [key: string]: JsonBody;
}

export interface HarnessResult {
  id: number;
  transport: 'fetch' | 'xhr';
  method: string;
  url: string;
  responseType: string;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  readyStates?: number[];
  redirected?: boolean;
  finalUrl?: string;
  durationMs: number;
  error: string | null;
  body: string | null;
  json: JsonBody;
  base64: string | null;
  byteLength: number;
  bodyKind: string;
}

export interface RequestOptions {
  transport?: 'fetch' | 'xhr';
  method?: string;
  url: string;
  responseType?: 'text' | 'json' | 'blob' | 'arraybuffer';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * What the page carries beyond a plain `Window`: the request driver from
 * `test-site/public/harness.js`, and the namespace the extension injects.
 *
 * Declared here so the `page.evaluate` callbacks below can be typed instead of
 * reaching through `any` — they run in the browser, where nothing knows about
 * either of these.
 */
interface HarnessWindow {
  harness?: {
    ready: boolean;
    request(options: RequestOptions): Promise<HarnessResult>;
  };
  OhMyMock?: { version?: string };
}

/** The test site page, with helpers that mirror `test-site/public/harness.js`. */
export class SitePage {
  constructor(public readonly page: Page) {}

  /** Navigates and waits until the page harness is ready to take requests. */
  async open(pathname = '/', origin = SITE_ORIGIN): Promise<void> {
    await this.page.goto(new URL(pathname, origin).toString());
    await this.page.waitForFunction(
      () => (window as unknown as HarnessWindow).harness?.ready === true
    );
  }

  /** Issues a request through the page and returns the normalised result. */
  async request(options: RequestOptions): Promise<HarnessResult> {
    return this.page.evaluate((opts: RequestOptions) => {
      const harness = (window as unknown as HarnessWindow).harness;

      if (!harness) {
        throw new Error('The page harness is not loaded');
      }

      return harness.request(opts);
    }, options);
  }

  /**
   * Waits until OhMyMock has patched the page. `window.OhMyMock.version` is set
   * by the injected bundle, so its presence means injection fully completed —
   * `window.OhMyMock` alone is set earlier by the early-inject shim.
   */
  async waitForInjection(timeout = 10_000): Promise<void> {
    await this.page.waitForFunction(
      () => Boolean((window as unknown as HarnessWindow).OhMyMock?.version),
      undefined,
      { timeout }
    );
  }

  /** Whether `test-site/public/harness.js` has finished loading. */
  async isHarnessReady(): Promise<boolean> {
    return this.page.evaluate(
      () => (window as unknown as HarnessWindow).harness?.ready === true
    );
  }

  async isInjected(): Promise<boolean> {
    return this.page.evaluate(() =>
      Boolean((window as unknown as HarnessWindow).OhMyMock?.version)
    );
  }
}

/** Talks to the test server's control plane (`/_harness/*`). */
export class TestServer {
  constructor(private readonly origin: string) {}

  async reset(): Promise<void> {
    await fetch(`${this.origin}/_harness/reset`, { method: 'POST' });
  }

  /** Per-endpoint request counts, keyed `"GET /api/json"`. */
  async hits(): Promise<Record<string, number>> {
    const response = await fetch(`${this.origin}/_harness/stats`);
    const body = (await response.json()) as { hits: Record<string, number> };
    return body.hits;
  }

  /** Convenience for the most common assertion: did this endpoint get hit? */
  async hitCount(key: string): Promise<number> {
    return (await this.hits())[key] ?? 0;
  }
}

/**
 * The extension's service worker, however it happens to be running right now.
 *
 * An MV3 service worker is not a thing that starts once and stays up: Chrome
 * stops it when it has been idle for about 30s and starts a fresh one when
 * something addresses the extension again. So a handle to *the* worker is only
 * valid for as long as that particular worker lives, and "there is no worker in
 * the list" is a normal, temporary state rather than a failure.
 *
 * Waiting only on `waitForEvent('serviceworker')` cannot see either fact: the
 * event fires once per worker, so a worker that came and went before the wait
 * started is invisible to it, and it never fires again for one that is already
 * listed. This polls the list as well, under a single deadline, and reports
 * what the browser actually had when it gives up.
 */
async function serviceWorkerFor(
  context: BrowserContext,
  timeout = 30_000
): Promise<Worker> {
  const deadline = Date.now() + timeout;

  for (;;) {
    const worker = context.serviceWorkers()[0];

    if (worker) {
      return worker;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `The extension's service worker never appeared within ${timeout}ms. ` +
          `The browser has ${context.pages().length} page(s) open and no ` +
          'service worker registered — usually that means Chromium refused ' +
          `the extension at ${EXTENSION_PATH}.`
      );
    }

    // A slice rather than the whole budget, so a worker that registers without
    // an event this listener can see is still picked up on the next pass.
    await context
      .waitForEvent('serviceworker', { timeout: 500 })
      .catch(() => undefined);
  }
}

interface Fixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  ohMy: OhMyMockDriver;
  site: SitePage;
  server: TestServer;
}

export const test = base.extend<Fixtures>({
  context: async ({}, use, testInfo) => {
    assertExtensionBuilt();

    const userDataDir = path.join(testInfo.outputDir, 'chrome-profile');

    const args = [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      // /dev/shm is small on many Linux boxes (and on a Pi); without this
      // Chromium can die mid-test with an out-of-memory renderer crash.
      '--disable-dev-shm-usage'
    ];

    if (!process.env.HEADED) {
      // The modern headless mode — unlike the old one, it runs extensions.
      args.push('--headless=new');
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args,
      viewport: { width: 1280, height: 800 }
    });

    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    await use(await serviceWorkerFor(context));
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  ohMy: async ({ context }, use) => {
    // The driver is handed a *resolver*, not a worker. Everything it does is a
    // `worker.evaluate`, and evaluating in a worker Chrome has since stopped
    // fails with "Target closed" — a handle captured at set-up time is a slow
    // fuse on any test that lets the extension go quiet for half a minute.
    const driver = new OhMyMockDriver(() => serviceWorkerFor(context));
    // The background script seeds demo data for its own demo domain on install;
    // clearing keeps assertions about "what is stored" unambiguous.
    await driver.reset();
    await use(driver);
  },

  server: async ({}, use) => {
    const server = new TestServer(SITE_ORIGIN);
    await server.reset();
    await use(server);
  },

  site: async ({ context }, use) => {
    const page = await context.newPage();
    await use(new SitePage(page));
    await page.close();
  }
});

export const expect = test.expect;
