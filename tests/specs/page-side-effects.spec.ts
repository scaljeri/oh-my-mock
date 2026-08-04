/**
 * What the extension does to a page it is not mocking.
 *
 * The content script matches `<all_urls>`, so it runs on every page in the
 * browser whether or not the domain is switched on. Everything it touches there
 * is a side effect on someone else's site.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';

test.describe('a page the extension is not mocking', () => {
  /**
   * `window.name` used to be overwritten on every load, on every domain.
   *
   * The parse of `window.name` had a `catch` that assigned `this.isReloaded =
   * false` — which reads like a reset and is a **setter** that writes
   * `window.name` back out. So a page whose `window.name` held anything else
   * lost it: a `window.open` target, an SSO handoff. The whole mechanism was
   * dead — nothing ever set the values it stored — so it is gone rather than
   * guarded.
   */
  test('keeps its window.name', async ({ ohMy, site }) => {
    await ohMy.setActive(SITE_DOMAIN, false);
    await site.open();

    await site.page.evaluate(() => {
      window.name = 'the-page-put-this-here';
    });

    // `window.name` survives a same-origin navigation, which is exactly what it
    // is used for — and is when the content script runs again.
    await site.open();

    expect(await site.page.evaluate(() => window.name)).toBe(
      'the-page-put-this-here'
    );
  });

  test('keeps its window.name on a domain that IS mocked', async ({
    ohMy,
    site
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { a: 1 }
    });
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
    await site.waitForInjection();

    await site.page.evaluate(() => {
      window.name = 'still-the-page-s';
    });

    await site.open();
    await site.waitForInjection();
    await site.request({ url: '/api/json', responseType: 'json' });

    expect(await site.page.evaluate(() => window.name)).toBe('still-the-page-s');
  });

  test('leaves nothing of its own in window.name', async ({ ohMy, site }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();
    await site.waitForInjection();

    // Empty is what a fresh page has. The extension used to leave
    // `{"forceActive":false,"isReloaded":false}` here.
    expect(await site.page.evaluate(() => window.name)).toBe('');

    expect(await ohMy.tabIdFor(SITE_ORIGIN)).toBeGreaterThan(0);
  });
});
