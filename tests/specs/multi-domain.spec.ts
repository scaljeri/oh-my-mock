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
   * A domain that is switched off does not get mocked because another port of
   * the same host is.
   *
   * The page-context bundle is registered per *host* — Chrome rejects a port in
   * a match pattern — so switching `localhost:8090` on puts the bundle on
   * `localhost:8091` too, where it starts out assuming it is wanted. A request
   * fired from `<head>` is therefore dispatched to the content script *before*
   * the `active: false` verdict has crossed back, and the content script is the
   * only thing that knows which port this is.
   *
   * Without its own check it would happily look the request up in this domain's
   * records and serve a mock the user had switched off — with no way to tell,
   * because a served mock looks exactly like a working endpoint. The bundle's
   * copy of the verdict cannot cover this: the whole point of the window is
   * that the bundle does not have one yet.
   */
  test('a switched-off domain is not mocked in the window before its verdict', async ({
    ohMy,
    site
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

    // The other port of the same host is on, which is what puts the bundle here.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MAIN_BODY
    });
    await ohMy.setActive(SITE_DOMAIN);

    // `onload.html` calls `/api/json` from an inline script in `<head>`, so the
    // request is in flight while the verdict still is.
    await site.page.goto(`${ALT_ORIGIN}/onload.html`);

    // The bundle is on this page — otherwise there is no window to be wrong in
    // and this spec proves nothing.
    expect(await site.isInjected()).toBe(true);

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
  });
});
