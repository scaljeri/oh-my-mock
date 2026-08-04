/**
 * The page's request always comes back.
 *
 * Several paths through the extension could return without answering the
 * injected script, and the injected script waited for ever: a content script
 * whose extension was reloaded under it, a packet with no data, a queue lane
 * deadlocked by a rejected handler, a throw inside the lookup. The page's
 * `fetch` simply never settled — which looks to a developer like their own site
 * hanging, with nothing in the console.
 *
 * Failing to mock is a reason to let a request through, never a reason to stop
 * the page.
 */

import { expect, SITE_DOMAIN, test } from '../fixtures/extension';

test.describe('a lookup that goes wrong', () => {
  /**
   * `IData.url` is matched as a regular expression. `url2regex` escapes what the
   * UI produces, but a hand-edited url or one from an imported backup goes in
   * raw — an unbalanced `)` makes `compareUrls` throw a `SyntaxError` inside
   * `findRequest`, in a promise nobody was catching.
   */
  test('lets the request through instead of hanging the page', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      // Not a valid regex: the `(` is never closed.
      url: '/api/(json',
      response: { from: 'the mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const before = await server.hitCount('GET /api/json');

    // The assertion is that this resolves at all. Playwright's own timeout is
    // what fails if it does not, which is exactly the symptom being fixed.
    const result = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(result.json).not.toEqual({ from: 'the mock' });
    expect(await server.hitCount('GET /api/json')).toBe(before + 1);
  });

  /**
   * And the page keeps working afterwards — a lookup that threw must not take
   * the content script's subscription down with it.
   */
  test('leaves the next request working', async ({ ohMy, site }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/(json',
      response: { from: 'the broken one' }
    });
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/users',
      response: { from: 'the good one' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    await site.request({ url: '/api/json', responseType: 'json' });

    const good = await site.request({
      url: '/api/users',
      responseType: 'json'
    });

    expect(good.json).toEqual({ from: 'the good one' });
  });
});
