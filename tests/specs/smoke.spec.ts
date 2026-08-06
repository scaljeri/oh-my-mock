/**
 * Proves the harness itself works before any mocking is involved.
 *
 * If these fail, nothing else in the suite is trustworthy: either the extension
 * did not load, the test site is not up, or the page harness is broken.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

test.describe('harness smoke', () => {
  test('the extension loads and its service worker runs', async ({
    serviceWorker,
    extensionId
  }) => {
    expect(extensionId).toMatch(/^[a-p]{32}$/);
    expect(serviceWorker.url()).toContain('background.js');

    const manifest = await serviceWorker.evaluate(() =>
      chrome.runtime.getManifest()
    );
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Oh-my-Mock');
  });

  test('the test site serves the page harness', async ({ site }) => {
    await site.open();
    await expect(site.page.getByRole('heading', { name: 'OhMyMock test site' })).toBeVisible();
    expect(await site.isHarnessReady()).toBe(true);
  });

  test('requests reach the server and are counted', async ({ site, server }) => {
    await site.open();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.status).toBe(200);
    expect(result.json.source).toBe('server');
    expect(result.headers['x-oh-my-source']).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);
  });

  test('OhMyMock stays out of the way while inactive', async ({ site, server }) => {
    await site.open();

    // Nothing at all. The page-context bundle is a content script the background
    // registers per *active* domain, so a domain nobody mocks never gets it —
    // no namespace on `window`, no patched `fetch`, nothing to go wrong on
    // somebody else's site. It used to go onto every page in the browser,
    // because that was the only way to be in place before anyone knew whether
    // the domain was mocked.
    expect(await site.isInjected()).toBe(false);
    expect(
      await site.page.evaluate(() => 'OhMyMock' in window)
    ).toBe(false);

    const result = await site.request({ url: '/api/json', responseType: 'json' });
    expect(result.json.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);
  });

  test('activating the domain injects OhMyMock into the page', async ({
    ohMy,
    site
  }) => {
    await ohMy.setActive(SITE_DOMAIN, true);
    await site.open();

    await site.waitForInjection();
    expect(await site.isInjected()).toBe(true);
  });
});
