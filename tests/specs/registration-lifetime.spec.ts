/**
 * Which domains get the page-context bundle does not survive the browser.
 *
 * OhMyMock registers `oh-my-mock.js` as a `world: 'MAIN'` content script per
 * active domain, and that registration is held by the browser rather than by
 * the extension. `chrome.scripting.registerContentScripts` reports
 * `persistAcrossSessions: true` for it — and it is gone in the next browser
 * session anyway: same profile, same extension id, nothing in between. Measured
 * on Chromium 151, which is what this spec pins.
 *
 * Nothing in Chrome puts it back. The store is therefore the only authority,
 * and `reconcileMainWorldScripts()` has to run at every service-worker start —
 * without it a browser restart leaves every mocked domain silently unmocked
 * until the user toggles it off and on again, which is exactly the sort of
 * failure this extension has no way of reporting.
 *
 * Unlike every other spec here this one launches its own browser, twice, over
 * the same profile directory. The `context` fixture makes a fresh profile per
 * test, which is right for isolation and useless for a question about what
 * survives a restart.
 */

import { chromium, type BrowserContext } from '@playwright/test';
import * as path from 'node:path';
import {
  EXTENSION_PATH,
  expect,
  serviceWorkerFor,
  SITE_DOMAIN,
  SITE_ORIGIN,
  test,
  TestServer
} from '../fixtures/extension';
import { OhMyMockDriver } from '../fixtures/oh-my-mock';

function launch(userDataDir: string): Promise<BrowserContext> {
  const args = [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--disable-dev-shm-usage'
  ];

  if (!process.env.HEADED) {
    args.push('--headless=new');
  }

  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args,
    viewport: { width: 1280, height: 800 }
  });
}

/** The ids this extension has registered right now, ours first. */
async function registeredIds(context: BrowserContext): Promise<string[]> {
  const worker = await serviceWorkerFor(context);

  return worker.evaluate(() =>
    chrome.scripting.getRegisteredContentScripts().then(scripts =>
      scripts.map(script => script.id).sort()
    )
  );
}

test.describe('registrations across a browser restart', () => {
  test('are gone, and are rebuilt from the store', async ({}, testInfo) => {
    const userDataDir = path.join(testInfo.outputDir, 'shared-profile');
    const server = new TestServer(SITE_ORIGIN);

    await server.reset(testInfo.titlePath.join(' > '));

    const first = await launch(userDataDir);

    try {
      const driver = new OhMyMockDriver(() => serviceWorkerFor(first));

      await driver.reset();
      await driver.seedMock({
        domain: SITE_DOMAIN,
        url: '/api/json',
        response: { source: 'mock' }
      });
      await driver.setActive(SITE_DOMAIN);

      // The registration exists in this session — otherwise the second half
      // below would be asserting about something that never happened.
      await expect
        .poll(() => registeredIds(first), { timeout: 10_000 })
        .toContain('oh-my-mock:localhost');
    } finally {
      await first.close();
    }

    const second = await launch(userDataDir);

    try {
      // The store still lists the domain as switched on, and mocking works —
      // which it only can because start-up read the store and registered again.
      const driver = new OhMyMockDriver(() => serviceWorkerFor(second));

      expect(await driver.domains()).toContain(SITE_DOMAIN);

      await expect
        .poll(() => registeredIds(second), { timeout: 10_000 })
        .toContain('oh-my-mock:localhost');

      const page = await second.newPage();

      await page.goto(SITE_ORIGIN);
      await page.waitForFunction(
        () => Boolean((window as unknown as { OhMyMock?: { version?: string } }).OhMyMock?.version),
        undefined,
        { timeout: 10_000 }
      );

      const body = await page.evaluate(() =>
        fetch('/api/json').then(response => response.text())
      );

      expect(body).toContain('"source":"mock"');
      expect(await server.hitCount('GET /api/json')).toBe(0);
    } finally {
      await second.close();
    }
  });
});
