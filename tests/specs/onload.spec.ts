/**
 * A request fired while the page is still parsing.
 *
 * This is the hardest moment for the extension to be ready in, and the most
 * ordinary one for an app to call its API from. The content script runs at
 * `document_start`, but it cannot know whether this domain is switched on until
 * it has read `chrome.storage`, and that read is async. Everything the page does
 * in the meantime is a race.
 *
 * `onload.html` calls `/api/json` from an inline script in `<head>` — no
 * `defer`, no listener, nothing awaited — and parks the outcome on
 * `window.onloadResult`. If mocking only works for requests made after the page
 * has settled, that is where it shows.
 */

import { expect, SITE_DOMAIN, SITE_ORIGIN, test } from '../fixtures/extension';

interface OnloadResult {
  pending: boolean;
  durationMs?: number;
  status?: number;
  source?: string | null;
  body?: string;
  error?: string;
}

/** Waits for the page's own on-load call to settle, and reports what it got. */
async function onloadResult(page: {
  waitForFunction: (fn: () => boolean) => Promise<unknown>;
  evaluate: <T>(fn: () => T) => Promise<T>;
}): Promise<OnloadResult> {
  await page.waitForFunction(
    () => (window as unknown as { onloadResult: OnloadResult }).onloadResult?.pending === false
  );

  return page.evaluate(
    () => (window as unknown as { onloadResult: OnloadResult }).onloadResult
  );
}

test.describe('a request made while the page loads', () => {
  test('is mocked, not raced', async ({ ohMy, site, server }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    // `site.open` waits for `window.harness`, which this page deliberately does
    // not load — the whole point is a bare page that calls its API immediately.
    await site.page.goto(`${SITE_ORIGIN}/onload.html`);

    const result = await onloadResult(site.page);

    expect(result.error).toBeUndefined();
    expect(result.body).toContain('"source":"mock"');
    // The header only a real response carries, and the counter behind it.
    expect(result.source).toBeNull();
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * The other side of it, and the reason this cannot be fixed by simply holding
   * every request until the extension is ready: with the domain switched off,
   * an on-load request has to go through untouched and *promptly*. A shim that
   * waits for an injection that is never coming would hang the page.
   */
  test('goes straight through while the domain is switched off', async ({
    site,
    server
  }) => {
    await site.page.goto(`${SITE_ORIGIN}/onload.html`);

    const result = await onloadResult(site.page);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(200);
    expect(result.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);

    // And it is not held for long. The shim now goes in on every page, so this
    // is the cost the extension adds to a domain it does nothing for: it holds
    // the call only until `contentState.init()` has read storage and said "not
    // this one". Generous on purpose — this is here to catch a page left
    // hanging, not to police a few milliseconds.
    expect(result.durationMs).toBeLessThan(1_000);
  });
});
