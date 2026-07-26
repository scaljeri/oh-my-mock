/**
 * Injection under a Content-Security-Policy.
 *
 * OhMyMock has to get code into the *page* context to patch `fetch` and
 * `XMLHttpRequest`, which a strict `script-src` forbids. `inject-code.ts`
 * handles that by waiting 500ms for the injected script to report in, and — if
 * it never does — asking the background script to strip CSP headers for the
 * domain via declarativeNetRequest, then reloading the page.
 *
 * That fallback rewrites response headers for the whole domain, so it is worth
 * a regression test in both directions: it must kick in when needed, and it
 * must stay out of the way when it is not.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

test.describe('content security policy', () => {
  test('injects normally on a page without CSP', async ({ ohMy, site }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open();

    await site.waitForInjection();
    expect(await site.isInjected()).toBe(true);
  });

  test('a report-only CSP does not block injection', async ({ ohMy, site }) => {
    await ohMy.setActive(SITE_DOMAIN);
    await site.open('/csp-report-only');

    await site.waitForInjection();
    expect(await site.isInjected()).toBe(true);
  });

  test('mocking works on a page behind a strict CSP', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open('/csp-strict');

    // The fallback reloads the page once CSP removal is active, so injection
    // legitimately takes longer here than on an unrestricted page.
    await site.waitForInjection(20_000);

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });
});
