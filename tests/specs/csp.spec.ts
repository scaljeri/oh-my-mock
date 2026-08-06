/**
 * Injection under a Content-Security-Policy.
 *
 * OhMyMock has to get code into the *page* context to patch `fetch` and
 * `XMLHttpRequest`. That used to mean a `<div onclick>` and a `<script src>`,
 * both of which a strict `script-src` forbids — so `inject-code.ts` waited
 * 500ms for the injected script to report in and, failing that, asked the
 * background to strip the site's CSP header via declarativeNetRequest and
 * reloaded the page.
 *
 * The bundle is a `world: 'MAIN'` content script now, which Chromium does not
 * apply the page's CSP to (measured on 151), so the third test below passes
 * without any of that happening — no header rewrite, no reload. The escalation
 * is still wired up in `page-context.ts` for a page-context bundle that fails
 * to arrive for some other reason, and nothing here exercises it any more.
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

    // The budget is still generous, because the fallback — strip the header and
    // reload — is what this used to need and would still take. A MAIN-world
    // content script is not subject to the page's CSP, so it should now arrive
    // as fast as on any other page.
    await site.waitForInjection(20_000);

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });
});
