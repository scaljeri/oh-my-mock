/**
 * The core promise of the extension: a seeded mock is served instead of the
 * real response, and the real endpoint is never contacted.
 *
 * Every test here asserts both halves. Checking only the body would pass even
 * if the extension fetched the real response and then discarded it, so the
 * server-side hit count is what actually proves interception.
 */

import { ALT_ORIGIN, expect, SITE_DOMAIN, test } from '../fixtures/extension';

const MOCK_BODY = { source: 'mock', message: 'served by OhMyMock' };

test.describe('mocking', () => {
  for (const transport of ['fetch', 'xhr'] as const) {
    test(`${transport}: a mocked response replaces the real one`, async ({
      ohMy,
      site,
      server
    }) => {
      await ohMy.seedMock({
        domain: SITE_DOMAIN,
        url: '/api/json',
        requestType: transport === 'fetch' ? 'FETCH' : 'XHR',
        response: MOCK_BODY
      });
      await ohMy.setActive(SITE_DOMAIN);

      await site.open();
      await site.waitForInjection();

      const result = await site.request({
        transport,
        url: '/api/json',
        responseType: 'json'
      });

      expect(result.status).toBe(200);
      expect(result.json).toEqual(MOCK_BODY);
      // The decisive assertion: the request never left the browser.
      expect(await server.hitCount('GET /api/json')).toBe(0);
    });
  }

  test('an unmocked endpoint still reaches the server', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MOCK_BODY
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/users', responseType: 'json' });

    expect(result.json['1'].name).toBe('Ada Lovelace');
    expect(await server.hitCount('GET /api/users')).toBe(1);
  });

  test('a disabled mock passes through to the server', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MOCK_BODY,
      enabled: false
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);
  });

  test('deactivating the domain stops all mocking', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MOCK_BODY
    });
    await ohMy.setActive(SITE_DOMAIN, false);

    await site.open();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('server');
    expect(await server.hitCount('GET /api/json')).toBe(1);
  });

  for (const transport of ['fetch', 'xhr'] as const) {
    test(`${transport}: a mock can change the status code`, async ({
      ohMy,
      site,
      server
    }) => {
      await ohMy.seedMock({
        domain: SITE_DOMAIN,
        url: '/api/json',
        requestType: transport === 'fetch' ? 'FETCH' : 'XHR',
        statusCode: 503,
        response: { error: 'service unavailable' }
      });
      await ohMy.setActive(SITE_DOMAIN);

      await site.open();
      await site.waitForInjection();

      const result = await site.request({
        transport,
        url: '/api/json',
        responseType: 'json'
      });

      expect(result.status).toBe(503);
      expect(await server.hitCount('GET /api/json')).toBe(0);
    });
  }

  // Regression test: a mocked fetch used to resolve with a bare `new Response()`
  // (internal status 200) and patch only the `status` getter, leaving the native
  // `ok` getter reading 200. `if (!res.ok) throw` never fired for a mocked 500.
  test(
    'fetch: Response.ok reflects the mocked status code',
    async ({ ohMy, site }) => {
      await ohMy.seedMock({
        domain: SITE_DOMAIN,
        url: '/api/json',
        statusCode: 503,
        response: { error: 'service unavailable' }
      });
      await ohMy.setActive(SITE_DOMAIN);

      await site.open();
      await site.waitForInjection();

      const result = await site.request({ url: '/api/json', responseType: 'json' });

      expect(result.status).toBe(503);
      expect(result.ok).toBe(false);
    }
  );

  test('a mock can replace response headers', async ({ ohMy, site }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/headers',
      headers: {
        'content-type': 'application/json',
        'x-oh-my-custom': 'mocked-value'
      },
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/headers', responseType: 'json' });

    expect(result.headers['x-oh-my-custom']).toBe('mocked-value');
    // The server marker must be absent: it only exists on real responses.
    expect(result.headers['x-oh-my-source']).toBeUndefined();
  });

  test('a mock delay postpones the response', async ({ ohMy, site }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MOCK_BODY,
      delay: 750
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json).toEqual(MOCK_BODY);
    // Generous lower bound: the point is that the delay was applied at all.
    expect(result.durationMs).toBeGreaterThanOrEqual(600);
  });

  test('mocks are scoped to the domain that owns them', async ({
    ohMy,
    site,
    server
  }) => {
    // Seeded for the main origin only; the alternate origin must be unaffected.
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MOCK_BODY
    });
    await ohMy.setActive(SITE_DOMAIN);

    // The alternate origin by name, not by port: a run picks its own ports (see
    // `playwright.config.ts`), so a literal `localhost:8091` is another run's
    // site as often as it is this one's.
    await site.open('/', ALT_ORIGIN);

    // Injected here too — it is injected on every page — but switched off, and
    // that is the distinction this test is about.
    expect(await site.isInjected()).toBe(true);

    const result = await site.request({ url: '/api/json', responseType: 'json' });
    expect(result.json.source).toBe('server');
    void server;
  });

  test('the extension records a hit on the mocked request', async ({
    ohMy,
    site
  }) => {
    const { dataId } = await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      response: MOCK_BODY
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    expect(await ohMy.getLastHit(SITE_DOMAIN, dataId)).toBe(0);

    await site.request({ url: '/api/json', responseType: 'json' });

    await expect
      .poll(() => ohMy.getLastHit(SITE_DOMAIN, dataId))
      .toBeGreaterThan(0);
  });

  /**
   * A request stored without a `requestType` still has to match.
   *
   * `StateUtils.findRequest` compared `search.requestType === v.requestType`,
   * guarded only on the *incoming* one being present — and the injected script
   * always sends one. So a stored request that had none could never match
   * anything, silently: no throw, no log, the call simply went to the server as
   * if no mock existed.
   *
   * `DataUtils.create` does not default the field, so every record built without
   * it lands in this state — a JSON import or a backup from an older version
   * being the ordinary way to get there.
   */
  test('a request stored without a requestType is still mocked', async ({
    ohMy,
    site,
    server
  }) => {
    await ohMy.seedMock({
      domain: SITE_DOMAIN,
      url: '/api/json',
      requestType: null,
      response: { source: 'mock' }
    });
    await ohMy.setActive(SITE_DOMAIN);

    await site.open();
    await site.waitForInjection();

    const result = await site.request({ url: '/api/json', responseType: 'json' });

    expect(result.json.source).toBe('mock');
    expect(await server.hitCount('GET /api/json')).toBe(0);
  });
});
