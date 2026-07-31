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
});
