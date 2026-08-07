/**
 * More than one domain switched on at the same time.
 *
 * `aux.appActive` is per domain and every page's content script reads its own,
 * so this should hold by construction — but "by construction" is how the
 * `popupActive` gate got in, which was browser-global and switched *everything*
 * off at once. Two domains mocking independently is the property that gate
 * quietly broke, and nothing asserted it.
 *
 * The test site serves a second origin on :8091 with its own hit counter, so
 * both sides can be checked for real rather than by inspecting storage.
 */

import {
  ALT_DOMAIN,
  ALT_ORIGIN,
  expect,
  SITE_DOMAIN,
  SITE_ORIGIN,
  test,
  TestServer
} from '../fixtures/extension';

const MAIN_BODY = { source: 'mock-main' };
const ALT_BODY = { source: 'mock-alt' };

test.describe('several active domains', () => {
  test('each mocks its own, and neither disturbs the other', async ({
    ohMy,
    site,
    server
  }) => {
    const altServer = new TestServer(ALT_ORIGIN);
    await altServer.reset();

    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MAIN_BODY
    });
    await ohMy.seedMock({
      domain: ALT_DOMAIN,
      url: '/api/json',
      response: ALT_BODY
    });

    // Both, one after the other — each writes its own state record.
    await ohMy.setActive(SITE_DOMAIN);
    await ohMy.setActive(ALT_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const fromMain = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(fromMain.json).toEqual(MAIN_BODY);
    expect(await server.hitCount('GET /api/json')).toBe(0);

    // The second origin, in the same browser, with the first still switched on.
    await site.open('/', ALT_ORIGIN);
    await site.waitForInjection();

    const fromAlt = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(fromAlt.json).toEqual(ALT_BODY);
    expect(await altServer.hitCount('GET /api/json')).toBe(0);

    // And back, to catch a "last one wins" that a single pass would miss.
    await site.open();
    await site.waitForInjection();

    const again = await site.request({ url: '/api/json', responseType: 'json' });

    expect(again.json).toEqual(MAIN_BODY);
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });

  test('switching one off leaves the other mocking', async ({
    ohMy,
    site,
    server
  }) => {
    const altServer = new TestServer(ALT_ORIGIN);
    await altServer.reset();

    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MAIN_BODY
    });
    await ohMy.seedMock({
      domain: ALT_DOMAIN,
      url: '/api/json',
      response: ALT_BODY
    });
    await ohMy.setActive(SITE_DOMAIN);
    await ohMy.setActive(ALT_DOMAIN);

    // The main one goes off; the alternate is untouched.
    await ohMy.setActive(SITE_DOMAIN, false);

    await site.open();
    const passedThrough = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(passedThrough.json.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);

    await site.open('/', ALT_ORIGIN);
    await site.waitForInjection();

    const stillMocked = await site.request({
      url: '/api/json',
      responseType: 'json'
    });

    expect(stillMocked.json).toEqual(ALT_BODY);
    expect(await altServer.hitCount('GET /api/json')).toBe(0);
  });

  /**
   * A domain that is switched off stays off while a sibling port is mocked.
   *
   * This used to be a test about a *window*. The bundle was registered per host
   * — `*://localhost/*`, because Chrome rejects a port under the wildcard
   * scheme — so switching `localhost:8090` on put it on `localhost:8091` as
   * well, where it started out assuming it was wanted. A request fired from
   * `<head>` was dispatched before the `active: false` verdict crossed back,
   * and only the content script's own check kept a switched-off domain's mocks
   * from being served.
   *
   * Naming the schemes carries the port through (`src/background/main-world.ts`),
   * so there is no bundle on the off port and no window to be wrong in. The
   * content script's check is still there and still matters — for a domain
   * switched off while its page is open, and for a registration that outlived
   * its domain — but neither is reachable from here, so it is pinned as a unit
   * in `src/content/handle-api-request.spec.ts` instead.
   *
   * What is left to assert here is the part that is about two domains: the off
   * one is untouched *and* the on one keeps mocking, so the isolation was not
   * bought by registering nothing.
   */
  test('a switched-off domain is untouched while its sibling port is mocked', async ({
    ohMy,
    site,
    server
  }) => {
    const altServer = new TestServer(ALT_ORIGIN);
    await altServer.reset();

    // The alternate has mocks of its own, and is *off*.
    await ohMy.seedMock({
      domain: ALT_DOMAIN,
      url: '/api/json',
      response: ALT_BODY
    });
    await ohMy.setActive(ALT_DOMAIN, false);

    // The other port of the same host is on.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MAIN_BODY
    });
    await ohMy.setActive(SITE_DOMAIN);

    // `onload.html` calls `/api/json` from an inline script in `<head>` — the
    // earliest a page can ask for anything, and the moment the old registration
    // was wrong at.
    await site.page.goto(`${ALT_ORIGIN}/onload.html`);

    // Registered per domain now, so the off port gets nothing at all.
    expect(await site.isInjected()).toBe(false);

    await site.page.waitForFunction(
      () =>
        (window as unknown as { onloadResult?: { pending: boolean } })
          .onloadResult?.pending === false
    );

    const result = await site.page.evaluate(
      () =>
        (window as unknown as {
          onloadResult: { body?: string; source?: string | null; error?: string };
        }).onloadResult
    );

    expect(result.error).toBeUndefined();
    // The real server answered, and its own mock did not.
    expect(result.source).toBe('server');
    expect(result.body).not.toContain('mock-alt');
    expect(await altServer.hitCount('GET /api/json')).toBe(1);

    // And the port that *is* on still mocks — the isolation is per domain, not
    // a registration that quietly went missing for both.
    await site.page.goto(`${SITE_ORIGIN}/onload.html`);
    await site.page.waitForFunction(
      () =>
        (window as unknown as { onloadResult?: { pending: boolean } })
          .onloadResult?.pending === false
    );

    const onMain = await site.page.evaluate(
      () => (window as unknown as { onloadResult: { body?: string } }).onloadResult
    );

    expect(onMain.body).toContain('mock-main');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });
});
